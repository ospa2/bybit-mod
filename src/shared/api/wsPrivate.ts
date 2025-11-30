import { USER_ID } from "../../core/config";
import { fetchFreshBybitToken } from "./tokenGetter";

interface BybitWebSocketConfig {
  url: string;
  token?: string; // <--- ОБЯЗАТЕЛЬНО: JWT токен для авторизации
  appId?: string;
  os?: string;
  deviceId: string;
}

interface SendMessageParams {
  userId?: number;
  orderId: string;
  message: string;
  contentType?: 'str' | 'image' | 'file';
  roleType?: 'user' | 'merchant';
}

export class BybitP2PWebSocket {
  private ws: WebSocket | null = null;
  private config: BybitWebSocketConfig;
  private currentToken: string | null = null; // Хранилище для токена
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Промисы для управления состоянием подключения
  private connectionPromise: Promise<void> | null = null;
  private connectionResolver: (() => void) | null = null;
  private connectionRejector: ((err: Error) => void) | null = null;

  constructor() {
    // Здесь выполняется только синхронная инициализация
    this.config = {
      appId: 'bybit',
      os: 'web',
      deviceId: '1104d31b-6be5-5e38-acb2-ff4e9ff9278a',
      url: 'wss://ws2.bybit.com/private',
    };
  }

  /**
   * Подключение к WebSocket и Авторизация
   */
  async connect(): Promise<void> {
    // 1. Если уже подключаемся, возвращаем текущий промис
    if (this.connectionPromise) return this.connectionPromise;

    // 2. Асинхронно получаем токен
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
        // Сразу после подключения отправляем ЛОГИН
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
        this.connectionPromise = null; // Сбрасываем промис
        this.handleReconnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });

    return this.connectionPromise;
  }

  /**
   * Отправка фрейма авторизации
   */
  private sendLogin(): void {
    if (!this.ws || !this.currentToken) return;

    const payload = {
      op: 'login',
      args: [this.currentToken], // Используем this.currentToken
      req_id: this.config.deviceId
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Отправка сообщения в ордер
   */
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

    // Внутренняя структура данных
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
        JSON.stringify(internalData) // Важно: это должна быть строка JSON
      ]
    };

    this.ws.send(JSON.stringify(payload));
    console.log('📤 Message sent payload:', payload);
  }

  /**
   * Подписка на топики
   */
  async subscribe(topics: string[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Можно добавить логику ожидания подключения
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
          // Только здесь мы считаем соединение полностью готовым
          if (this.connectionResolver) {
            this.connectionResolver();
            this.connectionResolver = null;
          }
          // Автоматически подписываемся на топик чата после логина
          this.subscribe(['FIAT_OTC_TOPIC']);
        } else {
          console.error('⛔ Auth Failed:', message.ret_msg);
          if (this.connectionRejector) {
            this.connectionRejector(new Error(`Auth Failed: ${message.ret_msg}`));
            this.connectionRejector = null;
          }
          this.disconnect(); // Разрываем, если логин не прошел
        }
        return;
      }

      // 2. Обработка входящих сообщений чата
      if (message.topic === 'OTC_USER_CHAT_MSG_V2' && message.type === 'RECEIVE') {
        console.log('📩 New Message Received:', message.data);
        // TODO: Вызвать callback или event emitter
      }

      // 3. Логирование ошибок API
      if (message.success === false) {
        console.warn('⚠️ API Error:', message);
      }

    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  // ... (Остальные методы: markAsRead, ping, reconnect, generateUUID остаются без изменений)

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
        // Сбрасываем промис перед повторным подключением
        this.connectionPromise = null;
        this.connect().catch(console.error);
      }, 2000 * this.reconnectAttempts);
    }
  }

  private generateUUID(): string {
    // Простая реализация UUID v4
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
  }
}