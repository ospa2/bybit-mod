// orderChatManager.ts
// ключ = фраза или список фраз/слов для поиска (в lower-case), значение = ответ или список вариантов

import type { BybitP2PWebSocket } from "../api/wsPrivate";
import type { OrderData } from "../types/ads";
import { bankLatinToCyrillic } from "../utils/bankParser";

const STORAGE_KEY_ACTIVE = 'bybit_p2p_active_orders_v1';
const STORAGE_KEY_PROCESSED = 'bybit_p2p_processed_msgs_v1';
const STORAGE_KEY_RATE = 'bybit_p2p_rate_v1';

interface OrderChannel {
   orderId: string;
   startedAt: number;
   opponentUserId?: number | string;
}
function wait(ms: number) {
   return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
   // задержка от 2 до 4 секунд
   return 2000 + Math.random() * 2000;
}

export class OrderChatManager {
   private wsClient: BybitP2PWebSocket;
   
   private bank: string = ""
   private keywords: Array<{
      matcher: RegExp | string;
      response: string | string[];
   }> = [
         { matcher: /(?:откуда\s(?:оплата|перевод|плат[её]ж)|како[ог][ой]\s(?:у\s(?:вас|тебя))?банк)/i, response: this.bank },
      ];

   private userData: Record<string, string> = {
      'payment': 'test1',
      'name': 'test2',
      'currency': 'test3'
   }; // твои данные для подстановки (например: платежка, имя, валюта)
   private replyRateLimitPerMinute = 6;

   constructor(wsClient: any) {
      this.wsClient = wsClient;
      
      // Подключим слушатель входящих сообщений.
      // Если wsClient поддерживает событие (preferred), подпишемся, иначе проксируем handleMessage.
      this.hookIncomingMessages();
      // Очистка при выгрузке страницы
      window.addEventListener('beforeunload', () => {
         // По желанию — не удаляем active orders автоматически, пусть служат пока ордер жив.
         // Но можно удалить stale channels, если нужно:
      });
   }

   /* ---------- localStorage helpers ---------- */
   private loadActive(): Record<string, OrderChannel> {
      try {
         const raw = localStorage.getItem(STORAGE_KEY_ACTIVE);
         return raw ? JSON.parse(raw) : {};
      } catch {
         return {};
      }
   }
   private saveActive(obj: Record<string, OrderChannel>) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(obj));
   }

   private loadProcessed(): Record<string, string[]> {
      try {
         const raw = localStorage.getItem(STORAGE_KEY_PROCESSED);
         return raw ? JSON.parse(raw) : {};
      } catch {
         return {};
      }
   }
   private saveProcessed(obj: Record<string, string[]>) {
      localStorage.setItem(STORAGE_KEY_PROCESSED, JSON.stringify(obj));
   }

   private loadRate(): Record<string, number[]> {
      // map orderId -> timestamps (ms) of replies sent
      try {
         const raw = localStorage.getItem(STORAGE_KEY_RATE);
         return raw ? JSON.parse(raw) : {};
      } catch {
         return {};
      }
   }
   private saveRate(obj: Record<string, number[]>) {
      localStorage.setItem(STORAGE_KEY_RATE, JSON.stringify(obj));
   }

   /* ---------- API: старт/стоп канала для ордера ---------- */
   startForOrder(orderId: string, opponentUserId?: number | string) {
      const active = this.loadActive();
      if (active[orderId]) return; // уже есть
      active[orderId] = { orderId, startedAt: Date.now(), opponentUserId };
      this.saveActive(active);
      console.log(`OrderChatManager: started channel for ${orderId}`);
   }

   stopForOrder(orderId: string) {
      const active = this.loadActive();
      if (!active[orderId]) return;
      delete active[orderId];
      this.saveActive(active);

      // удалить processed и rate, чтобы память не росла
      const processed = this.loadProcessed();
      delete processed[orderId];
      this.saveProcessed(processed);

      const rate = this.loadRate();
      delete rate[orderId];
      this.saveRate(rate);

      console.log(`OrderChatManager: stopped channel for ${orderId}`);
   }

   isActive(orderId: string) {
      const active = this.loadActive();
      return !!active[orderId];
   }
   private processingLock = new Set<string>();
   /* ---------- Основная логика обработки входящего сообщения ---------- */
   private async onIncomingChatMessage(payload: any) {
      // ожидаем структуру: { topic: 'OTC_USER_CHAT_MSG_V2', type: 'RECEIVE', data: { orderId, msgUuid?, userId, message, ... } }
      try {
         if (!payload || payload.topic !== 'OTC_USER_CHAT_MSG_V2' || payload.type !== 'RECEIVE') return;
         const data = payload.data || {};
         const orderId: string = data.orderId || data.order_id || data.otcOrderId || data.order; // сто раз встречается по-разному
         const orderAndCardRaw = localStorage.getItem("!orders")
         const ordersAndCards: OrderData[] = orderAndCardRaw ? JSON.parse(orderAndCardRaw) : {};
         this.bank = bankLatinToCyrillic(ordersAndCards.find((item) => item.order["Order No."] === orderId)?.card.bank)
         const incomingMsgId = data.msgUuid || data.msg_id || data.msgId || data.uuid || String(Date.now());
         // const fromUserId = data.userId || data.fromUserId || data.user_id;
         const textRaw = (data.message || data.text || '').toString();

         if (!orderId || !textRaw) return;

         // Если канал не активен — ничего не делаем
         if (!this.isActive(orderId)) return;

         // 🔒 БЛОКИРОВКА для предотвращения гонки
         const lockKey = `${orderId}_${incomingMsgId}`;
         if (this.processingLock.has(lockKey)) return;
         this.processingLock.add(lockKey);

         try {
            // ✅ ВСЕ ПРОВЕРКИ И ЗАПИСИ СИНХРОННО
            const processed = this.loadProcessed();
            processed[orderId] = processed[orderId] || [];
            if (processed[orderId].includes(incomingMsgId)) return; // дубликат
            processed[orderId].push(incomingMsgId);
            this.saveProcessed(processed);

            // ✅ Rate limit проверяем И РЕЗЕРВИРУЕМ место сразу
            if (!this.canReplyNow(orderId)) return;
            this.pushRateTimestamp(orderId, Date.now()); // ← СРАЗУ резервируем

            // ✅ Находим ответ
            const reply = this.findReplyForText(textRaw);
            if (!reply) return;

            const finalReply = this.interpolate(reply, this.userData);

            // ⏰ ТЕПЕРЬ ждём (все проверки уже прошли)
            await wait(randomDelay());

            // 📤 Отправляем
            await this.wsClient.sendMessage({
               orderId,
               message: finalReply,
               roleType: 'user'
            });

            console.log(`Auto-reply sent to order ${orderId}:`, finalReply);

         } finally {
            this.processingLock.delete(lockKey);
         }

      } catch (err) {
         console.error('OrderChatManager error:', err);
      }
   }

   /* ---------- Вспомогательные методы ---------- */
   private normalize(text: string) {
      return text.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
   }

   private findReplyForText(text: string): string | null {
      const norm = this.normalize(text);
      const words = new Set(norm.split(' ').filter(Boolean));

      for (const { matcher, response } of this.keywords) {
         let matched = false;

         if (matcher instanceof RegExp) {
            // Для regex проверяем оригинальный текст (не нормализованный)
            matched = matcher.test(text);
         } else {
            // Для строки используем старую логику
            const key = matcher.toLowerCase();
            if (key.includes(' ')) {
               matched = norm.includes(key);
            } else {
               matched = words.has(key);
            }
         }

         if (matched) {
            return Array.isArray(response) ? this.pick(response) : response;
         }
      }
      return null;
   }

   private pick(arr: string[] | string) {
      if (Array.isArray(arr)) {
         const idx = Math.floor(Math.random() * arr.length);
         return arr[idx];
      }
      return arr;
   }

   private interpolate(template: string, data: Record<string, string>) {
      // подставляет {key} => data[key] если есть
      return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => (data[k] ?? `{${k}}`));
   }

   /* ---------- rate limit ---------- */
   private canReplyNow(orderId: string) {
      const rate = this.loadRate();
      rate[orderId] = rate[orderId] || [];
      const now = Date.now();
      // оставляем только метки внутри последней минуты
      rate[orderId] = rate[orderId].filter(ts => now - ts < 60_000);
      this.saveRate(rate);
      return rate[orderId].length < this.replyRateLimitPerMinute;
   }

   private pushRateTimestamp(orderId: string, ts: number) {
      const rate = this.loadRate();
      rate[orderId] = rate[orderId] || [];
      rate[orderId].push(ts);
      // trim > 100
      if (rate[orderId].length > 100) rate[orderId].splice(0, rate[orderId].length - 100);
      this.saveRate(rate);
   }

   /* ---------- Hook to incoming WS messages ---------- */
   private hookIncomingMessages() {
      // 1) если wsClient предоставляет подписку на события — используем её
      if (this.wsClient && typeof this.wsClient.on === 'function') {
         // предполагаем, что wsClient.emit('message', parsedMessage) делает
         this.wsClient.on('message', (msg: any) => {
            this.onIncomingChatMessage(msg).catch(console.error);
         });
         return;
      }

      // 2) иначе мы попытаемся "проксировать" оригинальный обработчик handleMessage:
      //    заменим метод wsClient.handleMessage на обёртку, чтобы получать приходящие сообщения
      const target = this.wsClient as any;
      if (target && typeof target.handleMessage === 'function') {
         const orig = target.handleMessage.bind(target);
         const self = this;
         target.handleMessage = function (data: any) {
            // пытаемся парсить если пришла строка
            try {
               const parsed = typeof data === 'string' ? JSON.parse(data) : data;
               // call manager handler (не ждём завершения)
               self.onIncomingChatMessage(parsed).catch(console.error);
            } catch (err) {
               // если не JSON — всё равно вызвать оригинальный
            }
            // вызвать оригинал (чтобы не ломать логику)
            return orig(data);
         };
         console.log('OrderChatManager: hooked into wsClient.handleMessage');
         return;
      }

      console.warn('OrderChatManager: unable to hook into wsClient incoming messages automatically. Provide messages manually.');
   }
}
