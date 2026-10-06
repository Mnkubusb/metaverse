/* eslint-disable @typescript-eslint/no-explicit-any */
export default class WebSocketService {
  private url: string;
  private token: string;
  private spaceId: string;
  private socket: WebSocket | null;
  private isConnected: boolean;
  private onMessageCallback: (message: any) => void;
  private onCloseCallback: () => void;
  private closedByUs = false;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, token: string, spaceId: string, onMessage: (message: any) => void, onClose: () => void) {
    this.url = url || '';
    this.token = token;
    this.spaceId = spaceId;
    this.onMessageCallback = onMessage;
    this.onCloseCallback = onClose;
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (this.socket) {
      this.socket.close();
    }

    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      this.isConnected = true;
      this.retries = 0;
      this.joinSpace();
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = () => {
      this.isConnected = false;
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
      // Dropped by the network or the host (free tiers sleep, Vercel caps connection
      // length): come back with exponential backoff and rejoin the space.
      if (!this.closedByUs) {
        const delay = Math.min(30_000, 1000 * 2 ** this.retries++);
        this.retryTimer = setTimeout(() => this.connect(), delay);
      }
    };

    return this;
  }

  joinSpace() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.spaceId || !this.token) {
      return;
    }
    this.sendMessage({
      type: 'join',
      payload: {
        spaceId: this.spaceId,
        token: this.token
      }
    });
  }

  sendMessage(message: {
    type: string;
    payload: any;
  }) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  move(x: number, y: number) {
    this.sendMessage({
      type: 'move',
      payload: { x, y }
    });
  }

  disconnect() {
    this.closedByUs = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.socket && this.socket.readyState <= 1) {
      this.socket.close();
    }
    this.socket = null;
    this.isConnected = false;
  }
}
