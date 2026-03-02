/**
 * WebSocket客户端服务 - 连接后端WebSocket服务器
 *
 * 用于前端应用（小程序、理赔员工作台）与后端实时通信
 */

interface WebSocketConfig {
  url: string;
  userId: string;
  userType: 'user' | 'adjuster' | 'ai';
  token?: string;
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onTyping?: (data: any) => void;
}

interface WSMessage {
  type: 'auth' | 'chat' | 'typing' | 'read' | 'disconnect' | 'error';
  payload?: any;
  success?: boolean;
  error?: string;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isConnecting: boolean = false;
  private messageQueue: WSMessage[] = [];

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  /**
   * 连接WebSocket
   */
  connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('WebSocket连接成功');
        this.isConnecting = false;

        // 发送认证消息
        this.sendAuthMessage();

        // 开始心跳
        this.startHeartbeat();

        // 处理消息队列
        this.flushMessageQueue();

        // 回调
        this.config.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息错误:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket连接关闭');
        this.isConnecting = false;
        this.stopHeartbeat();

        // 触发断线重连
        this.reconnect();

        this.config.onDisconnect?.();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.isConnecting = false;

        this.config.onError?.(error);
      };
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      this.isConnecting = false;
      this.reconnect();
    }
  }

  /**
   * 发送认证消息
   */
  private sendAuthMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const authMessage: WSMessage = {
      type: 'auth',
      payload: {
        userId: this.config.userId,
        userType: this.config.userType,
        token: this.config.token,
      },
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case 'auth':
        if (message.success) {
          console.log(`认证成功: ${this.config.userId} (${this.config.userType})`);
        } else {
          console.error('认证失败:', message.error);
        }
        break;

      case 'chat':
        // 聊天消息
        this.config.onMessage?.(message.payload);
        break;

      case 'typing':
        // 正在输入状态
        this.config.onTyping?.(message.payload);
        break;

      case 'read':
        // 消息已读状态
        this.config.onMessage?.(message.payload);
        break;

      case 'disconnect':
        // 用户离线
        console.log('用户离线:', message.payload);
        break;

      case 'error':
        // 错误消息
        console.error('WebSocket错误:', message.error);
        break;

      default:
        console.warn('未知消息类型:', message.type);
    }
  }

  /**
   * 发送聊天消息
   */
  sendChatMessage(conversationId: string, content: string, attachments?: any[]): void {
    const message: WSMessage = {
      type: 'chat',
      payload: {
        conversationId,
        senderId: this.config.userId,
        senderName: this.getUserName(),
        senderType: this.config.userType,
        content,
        attachments,
        timestamp: Date.now(),
      },
    };

    this.sendMessage(message);
  }

  /**
   * 发送正在输入状态
   */
  sendTyping(conversationId: string, userName: string): void {
    const message: WSMessage = {
      type: 'typing',
      payload: {
        conversationId,
        userName,
      },
    };

    this.sendMessage(message);
  }

  /**
   * 标记消息为已读
   */
  sendReadReceipt(conversationId: string, messageId: string): void {
    const message: WSMessage = {
      type: 'read',
      payload: {
        conversationId,
        messageId,
      },
    };

    this.sendMessage(message);
  }

  /**
   * 发送消息
   */
  private sendMessage(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // 连接未建立，加入队列
      this.messageQueue.push(message);
      console.log('消息已加入队列，等待连接建立...');
    }
  }

  /**
   * 处理消息队列
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    console.log(`发送队列中的 ${this.messageQueue.length} 条消息`);
    this.messageQueue.forEach((message) => {
      this.sendMessage(message);
    });
    this.messageQueue = [];
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 断线重连
   */
  private reconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('尝试重新连接...');
      this.connect();
    }, 3000); // 3秒后重连
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnecting = false;
    console.log('WebSocket连接已断开');
  }

  /**
   * 获取用户名（模拟）
   */
  private getUserName(): string {
    const names: Record<string, string> = {
      user: '用户',
      adjuster: '理赔员',
      ai: 'AI助手',
    };

    return names[this.config.userType] || '未知用户';
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export default WebSocketClient;
