import { USER_ID } from "../../core/config";
import { fetchFreshBybitToken } from "./tokenGetter";

interface SendMessageParams {
  userId?: number;
  orderId: string;
  message: string;
  contentType?: 'str' | 'image' | 'file';
  roleType?: 'user' | 'merchant';
}
interface BybitWebSocketConfig {
  url: string;
  token?: string; // <--- ОБЯЗАТЕЛЬНО: JWT токен для авторизации
  appId?: string;
  os?: string;
  deviceId: string;
}
// Добавляем тип для обработчиков событий
type EventHandler = (data: any) => void;

export class BybitP2PWebSocket {
  private ws: WebSocket | null = null;
  private config: BybitWebSocketConfig;
  private currentToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Промисы для управления состоянием подключения
  private connectionPromise: Promise<void> | null = null;
  private connectionResolver: (() => void) | null = null;
  private connectionRejector: ((err: Error) => void) | null = null;

  // ✅ ДОБАВЛЯЕМ: Event Emitter
  private eventHandlers: Map<string, EventHandler[]> = new Map();

  constructor() {
    this.config = {
      appId: 'bybit',
      os: 'web',
      deviceId: '1104d31b-6be5-5e38-acb2-ff4e9ff9278a',
      url: 'wss://ws2.bybit.com/private',
    };
  }

  // ✅ ДОБАВЛЯЕМ: Метод подписки на события
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  // ✅ ДОБАВЛЯЕМ: Метод отписки от событий
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // ✅ ДОБАВЛЯЕМ: Метод генерации событий
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in event handler for "${event}":`, err);
        }
      });
    }
  }

  /**
   * Подключение к WebSocket и Авторизация
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise;

    try {
      this.currentToken = await fetchFreshBybitToken();
    } catch (e) {
      throw new Error('Could not fetch authentication token.');
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionResolver = resolve;
      this.connectionRejector = reject;

      const timestamp = Date.now();
      const wsUrl = `${this.config.url}?appid=${this.config.appId}&os=${this.config.os}&deviceid=${this.config.deviceId}&timestamp=${timestamp}`;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.sendLogin();
        this.startPingInterval();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        if (this.connectionRejector) this.connectionRejector(new Error('WebSocket Error'));
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed (Code: ${event.code})`);
        this.stopPingInterval();
        this.connectionPromise = null;
        this.handleReconnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });

    return this.connectionPromise;
  }

  private sendLogin(): void {
    if (!this.ws || !this.currentToken) return;

    const payload = {
      op: 'login',
      args: [this.currentToken],
      req_id: this.config.deviceId
    };

    this.ws.send(JSON.stringify(payload));
  }

  async sendMessage(params: SendMessageParams): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const {
      userId = USER_ID,
      orderId,
      message,
      contentType = 'str',
      roleType = 'user'
    } = params;

    const msgUuid = this.generateUUID();
    const timestamp = Date.now();
    const msgId = `OTC_USER_CHAT_MSG_V2-SEND-${timestamp}-${orderId}`;

    const internalData = {
      topic: 'OTC_USER_CHAT_MSG_V2',
      type: 'SEND',
      data: {
        userId,
        orderId,
        message,
        contentType,
        msgUuid,
        roleType
      },
      msgId,
      reqId: this.config.deviceId
    };

    const payload = {
      op: 'input',
      args: [
        'FIAT_OTC_TOPIC',
        JSON.stringify(internalData)
      ]
    };

    this.ws.send(JSON.stringify(payload));
    console.log('📤 Message sent payload:', payload);
  }

  async subscribe(topics: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe, WS not open');
      return;
    }

    const payload = {
      op: 'subscribe',
      args: topics
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Обработка входящих сообщений
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // 1. Обработка ответа на ЛОГИН
      if (message.request && message.request.op === 'login') {
        if (message.success) {
          if (this.connectionResolver) {
            this.connectionResolver();
            this.connectionResolver = null;
          }
          this.subscribe(['FIAT_OTC_TOPIC']);
        } else {
          console.error('⛔ Auth Failed:', message.ret_msg);
          if (this.connectionRejector) {
            this.connectionRejector(new Error(`Auth Failed: ${message.ret_msg}`));
            this.connectionRejector = null;
          }
          this.disconnect();
        }
        return;
      }

      // 2. ✅ ЭМИТИМ событие 'message' для всех входящих сообщений
      this.emit('message', message);

      // 3. Обработка входящих сообщений чата
      if (message.topic === 'OTC_USER_CHAT_MSG_V2' && message.type === 'RECEIVE') {
        console.log('📩 New Message Received:', message.data);
        // ✅ ЭМИТИМ специфичное событие для чата
        this.emit('chat:message', message);
      }

      // 4. Логирование ошибок API
      if (message.success === false) {
        console.warn('⚠️ API Error:', message);
        this.emit('error', message);
      }

    } catch (error) {
      console.error('Error parsing message:', error);
      this.emit('error', error);
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const payload = {
          op: 'ping',
          args: [Date.now()]
        };
        this.ws.send(JSON.stringify(payload));
      }
    }, 15000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => {
        this.connectionPromise = null;
        this.connect().catch(console.error);
      }, 2000 * this.reconnectAttempts);
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // ✅ Очищаем обработчики событий
    this.eventHandlers.clear();
  }
}