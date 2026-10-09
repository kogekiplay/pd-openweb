/** The bridge envelope is validated independently of application-specific method payloads. */
export interface IframeRequest {
  type: 'IFRAME_REQUEST';
  tunnelId: string;
  methodName: string;
  params: unknown;
  messageId: string;
}
export type IframeResponse =
  | { type: 'IFRAME_RESPONSE'; messageId: string; success: true; data: unknown }
  | { type: 'IFRAME_RESPONSE'; messageId: string; success: false; error: string };
export type BridgeDecoder<Value> = (value: unknown) => Value;
export type BridgeHandler = (params: unknown) => unknown | Promise<unknown>;
export interface PendingBridgeRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timestamp: number;
}
export interface BridgeOptions {
  tunnelId?: string | undefined;
}
export interface MessageHandlerOptions extends BridgeOptions {
  /** The current frame may change after a remount; read its actual window for every request. */
  getSource?: (() => WindowProxy | null) | undefined;
}
