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
      console.log('WebSocket connected');
      this.isConnected = true;
      // Only join after the connection is established
      this.joinSpace(); 
    };

    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    };

    return this;
  }

  joinSpace() {
    console.log(this.socket?.readyState)
    // Check if socket exists and is in an open state
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.spaceId || !this.token) {
      console.log('Cannot join space - socket not ready or missing credentials');
      return;
    }
    
    console.log("Joining space:", this.spaceId);
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
    // Check if socket exists and is in an open state
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log('Cannot send message - socket not ready');
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