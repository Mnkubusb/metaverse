/* eslint-disable @typescript-eslint/no-explicit-any */
export default class WebSocketService {
  private url: string;
  private token: string;
  private spaceId: string;
  private socket: WebSocket | null;
  private isConnected: boolean;
  private onMessageCallback: (message: any) => void;
  private onCloseCallback: () => void;

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
    if (this.socket?.readyState === 1) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }
}
