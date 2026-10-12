declare module 'socket.io-client' {
  export interface Socket {
    on(event: string, handler: (data: unknown) => void): Socket;
  }
  export interface SocketOptions {
    path?: string;
    reconnectionAttempts?: number;
    timeout?: number;
    query?: Record<string, string | null>;
    transports?: string[];
  }
  export function connect(url?: string, options?: SocketOptions): Socket;
  const io: { connect: typeof connect };
  export default io;
}
