import type {
  BridgeDecoder,
  BridgeHandler,
  BridgeOptions,
  IframeRequest,
  IframeResponse,
  MessageHandlerOptions,
  PendingBridgeRequest,
} from './iframeCommunicateTypes';

function messageObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requestMessage(value: unknown): IframeRequest | undefined {
  if (
    !messageObject(value) ||
    value['type'] !== 'IFRAME_REQUEST' ||
    typeof value['tunnelId'] !== 'string' ||
    typeof value['methodName'] !== 'string' ||
    typeof value['messageId'] !== 'string'
  )
    return undefined;
  return {
    type: 'IFRAME_REQUEST',
    tunnelId: value['tunnelId'],
    methodName: value['methodName'],
    messageId: value['messageId'],
    params: value['params'],
  };
}
function windowSource(source: MessageEventSource | null): source is WindowProxy {
  try {
    return source !== null && 'window' in source && source.window === source;
  } catch {
    return false;
  }
}
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (messageObject(error) && typeof error['message'] === 'string') return error['message'];
  return typeof error === 'string' ? error : 'Iframe handler failed';
}

// for iframe 页面
export class ParentBridge {
  private _messageIdCounter = 0;
  readonly pendingPromises = new Map<string, PendingBridgeRequest>();
  timeout = 30000;
  readonly tunnelId: string;
  private destroyed = false;
  private readonly responseListener = (event: MessageEvent<unknown>): void => this.handleResponse(event);

  constructor({ tunnelId = 'global' }: BridgeOptions = {}) {
    this.tunnelId = tunnelId;
    window.addEventListener('message', this.responseListener);
  }

  generateMessageId(): string {
    return `${Date.now()}-${this._messageIdCounter++}-${Math.random().toString(36).slice(2)}`;
  }

  call(methodName: string, params?: unknown): Promise<unknown>;
  call<Value>(methodName: string, params: unknown, decode: BridgeDecoder<Value>): Promise<Value>;
  async call(methodName: string, params?: unknown, decode?: BridgeDecoder<unknown>): Promise<unknown> {
    if (this.destroyed) throw new Error('Parent bridge destroyed');
    const messageId = this.generateMessageId();
    const result = await new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const pending = this.pendingPromises.get(messageId);
        if (!pending) return;
        this.pendingPromises.delete(messageId);
        pending.reject(new Error(`Call to ${methodName} timed out after ${this.timeout}ms`));
      }, this.timeout);
      this.pendingPromises.set(messageId, {
        resolve: value => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject: error => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timestamp: Date.now(),
      });
      const request: IframeRequest = {
        type: 'IFRAME_REQUEST',
        tunnelId: this.tunnelId,
        methodName,
        params,
        messageId,
      };
      try {
        window.parent.postMessage(request, '*');
      } catch (error: unknown) {
        const pending = this.pendingPromises.get(messageId);
        this.pendingPromises.delete(messageId);
        pending?.reject(new Error(errorMessage(error)));
      }
    });
    return decode ? decode(result) : result;
  }

  handleResponse(event: MessageEvent<unknown>): void {
    if (this.destroyed || event.source !== window.parent || !messageObject(event.data)) return;
    const response = event.data;
    if (response['type'] !== 'IFRAME_RESPONSE' || typeof response['messageId'] !== 'string') return;
    // Existing responses carry no tunnelId; if supplied, it must match this bridge.
    if (response['tunnelId'] !== undefined && response['tunnelId'] !== this.tunnelId) return;
    const pending = this.pendingPromises.get(response['messageId']);
    if (!pending) return;
    this.pendingPromises.delete(response['messageId']);
    if (response['success'] === true) pending.resolve(response['data']);
    else if (response['success'] === false && typeof response['error'] === 'string')
      pending.reject(new Error(response['error']));
    else pending.reject(new Error('Invalid iframe response'));
  }

  cleanup(): void {
    const now = Date.now();
    for (const [messageId, pending] of this.pendingPromises) {
      if (now - pending.timestamp > this.timeout) {
        this.pendingPromises.delete(messageId);
        pending.reject(new Error('Request timeout'));
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('message', this.responseListener);
    for (const pending of this.pendingPromises.values()) pending.reject(new Error('Parent bridge destroyed'));
    this.pendingPromises.clear();
  }
}

// for 主页面
export class MessageHandler {
  readonly handlers = new Map<string, BridgeHandler>();
  readonly processingRequests = new Map<WindowProxy, Set<string>>();
  readonly tunnelId: string;
  private readonly getSource: MessageHandlerOptions['getSource'];
  private destroyed = false;
  private readonly requestListener = (event: MessageEvent<unknown>): void => {
    void this.handleMessage(event);
  };

  constructor({ tunnelId = 'global', getSource }: MessageHandlerOptions = {}) {
    this.tunnelId = tunnelId;
    this.getSource = getSource;
    window.addEventListener('message', this.requestListener);
  }

  register(methodName: string, handler: BridgeHandler): void;
  register<Params>(
    methodName: string,
    handler: (params: Params) => unknown | Promise<unknown>,
    decode: BridgeDecoder<Params>,
  ): void;
  register(methodName: string, handler: BridgeHandler, decode?: BridgeDecoder<unknown>): void {
    if (this.destroyed) throw new Error('Message handler destroyed');
    this.handlers.set(methodName, decode ? params => handler(decode(params)) : handler);
  }

  async handleMessage(event: MessageEvent<unknown>): Promise<void> {
    if (this.destroyed) return;
    const request = requestMessage(event.data);
    const source = event.source;
    if (!request || request.tunnelId !== this.tunnelId || !windowSource(source)) return;
    if (this.getSource) {
      try {
        if (source !== this.getSource()) return;
      } catch {
        return;
      }
    }
    const processing = this.processingRequests.get(source) || new Set<string>();
    if (processing.has(request.messageId)) return;
    processing.add(request.messageId);
    this.processingRequests.set(source, processing);
    try {
      const handler = this.handlers.get(request.methodName);
      if (!handler) throw new Error(`Method ${request.methodName} not found`);
      const result = await handler(request.params);
      if (this.destroyed) return;
      const response: IframeResponse = {
        type: 'IFRAME_RESPONSE',
        messageId: request.messageId,
        success: true,
        data: result,
      };
      source.postMessage(response, '*');
    } catch (error: unknown) {
      if (this.destroyed) return;
      const response: IframeResponse = {
        type: 'IFRAME_RESPONSE',
        messageId: request.messageId,
        success: false,
        error: errorMessage(error),
      };
      try {
        source.postMessage(response, '*');
      } catch {
        /* The receiver may close or reject structured cloning. */
      }
    } finally {
      processing.delete(request.messageId);
      if (processing.size === 0) this.processingRequests.delete(source);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('message', this.requestListener);
    this.handlers.clear();
    this.processingRequests.clear();
  }
}
