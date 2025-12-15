// orderChatManager.ts

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
    const delay = Math.random() * 2000;
    return delay;
}

export class OrderChatManager {
    private wsClient: BybitP2PWebSocket;

    private bank: string = ""
    private keywords: Array<{
        matcher: RegExp | string;
        response: string | string[];
    }> = [
            { matcher: /(?:откуда\s*(?:оплата|перевод|плат[её]ж)|как[ог]г*[ой]\s*(?:у\s*(?:вас|тебя))?\s*банк)/, response: this.bank },
            { matcher: /(?:на\sпочт|работаем)/, response: "Да" },
            { matcher: /(?:лицо|личная\sкарта)/, response: "Можно с карты родственника? лк у меня" },
            { matcher: /(?:лк\sна\sруках|лк\sу\sвас)/, response: "Да" },
            { matcher: /(?:знае(?:те|шь)|умее(?:те|шь)|подтверди(?:те|шь)|сможе(?:те|шь)|предостави(?:те|шь))/, response: "Да" },
        ];

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
            const data = raw ? JSON.parse(raw) : {};
            return data;
        } catch (e) {
            console.error('[OrderChatManager:loadActive] Error loading active orders:', e);
            return {};
        }
    }
    private saveActive(obj: Record<string, OrderChannel>) {
        localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(obj));
    }

    private loadProcessed(): Record<string, string[]> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PROCESSED);
            const data = raw ? JSON.parse(raw) : {};
            return data;
        } catch (e) {
            console.error('[OrderChatManager:loadProcessed] Error loading processed messages:', e);
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
            const data = raw ? JSON.parse(raw) : {};
            return data;
        } catch (e) {
            console.error('[OrderChatManager:loadRate] Error loading rate limits:', e);
            return {};
        }
    }
    private saveRate(obj: Record<string, number[]>) {
        localStorage.setItem(STORAGE_KEY_RATE, JSON.stringify(obj));
    }

    /* ---------- API: старт/стоп канала для ордера ---------- */
    startForOrder(orderId: string, opponentUserId?: number | string) {
        const active = this.loadActive();
        if (active[orderId]) {
            console.warn(`[OrderChatManager:startForOrder] Channel for ${orderId} is already active. Skipping.`);
            return; // уже есть
        }
        active[orderId] = { orderId, startedAt: Date.now(), opponentUserId };
        this.saveActive(active);
    }

    stopForOrder(orderId: string) {
        const active = this.loadActive();
        if (!active[orderId]) {
            console.warn(`[OrderChatManager:stopForOrder] Channel for ${orderId} is not active. Skipping stop.`);
            return;
        }
        delete active[orderId];
        this.saveActive(active);

        // удалить processed и rate, чтобы память не росла
        const processed = this.loadProcessed();
        delete processed[orderId];
        this.saveProcessed(processed);

        const rate = this.loadRate();
        delete rate[orderId];
        this.saveRate(rate);
    }

    isActive(orderId: string) {
        const active = this.loadActive();
        const isActive = !!active[orderId];
        return isActive;
    }
    private processingLock = new Set<string>();
    /* ---------- Основная логика обработки входящего сообщения ---------- */
    private async onIncomingChatMessage(payload: any) {
        // ожидаем структуру: { topic: 'OTC_USER_CHAT_MSG_V2', type: 'RECEIVE', data: { orderId, msgUuid?, userId, message, ... } }
        try {
            if (!payload || payload.topic !== 'OTC_USER_CHAT_MSG_V2' || payload.type !== 'RECEIVE') {
                return;
            }
            const data = payload.data || {};
            const orderId: string = data.orderId || data.order_id || data.otcOrderId || data.order;
            const orderAndCardRaw = localStorage.getItem("!orders")
            const ordersAndCards: OrderData[] = orderAndCardRaw ? JSON.parse(orderAndCardRaw) : {};
            const foundOrder = ordersAndCards.find((item) => item.order["Order No."] === orderId);

            if (foundOrder) {
                this.bank = bankLatinToCyrillic(foundOrder.card.bank);
            } else {
                console.warn(`[OrderChatManager:onIncomingChatMessage] Order data not found for orderId: ${orderId}`);
            }

            const incomingMsgId = data.msgUuid || data.msg_id || data.msgId || data.uuid || String(Date.now());
            const textRaw = (data.message || data.text || '').toString();

            if (!orderId || !textRaw) {
                console.warn(`[OrderChatManager:onIncomingChatMessage] Missing orderId or message text. orderId: ${orderId}, textRaw: ${textRaw.substring(0, 50)}`);
                return;
            }

            // 🔒 БЛОКИРОВКА для предотвращения гонки
            const lockKey = `${orderId}_${incomingMsgId}`;
            if (this.processingLock.has(lockKey)) {
                return;
            }
            this.processingLock.add(lockKey);

            try {
                // ✅ ВСЕ ПРОВЕРКИ И ЗАПИСИ СИНХРОННО
                const processed = this.loadProcessed();
                processed[orderId] = processed[orderId] || [];
                if (processed[orderId].includes(incomingMsgId)) {
                    return;
                }
                processed[orderId].push(incomingMsgId);
                this.saveProcessed(processed);

                // ✅ Находим ВСЕ подходящие ответы
                const replies = this.findAllRepliesForText(textRaw);
                if (replies.length === 0) {
                    return;
                }

                // ✅ Отправляем каждый ответ по очереди
                for (let i = 0; i < replies.length; i++) {
                    const reply = replies[i];

                    // ✅ Rate limit проверяем перед каждым сообщением
                    if (!this.canReplyNow(orderId)) {
                        console.warn(`[OrderChatManager:onIncomingChatMessage] Rate limit exceeded for order ${orderId} on reply ${i + 1}/${replies.length}. Skipping remaining replies.`);
                        break;
                    }
                    this.pushRateTimestamp(orderId, Date.now());

                    // ⏰ Ждём перед отправкой
                    await wait(randomDelay());

                    // 📤 Отправляем
                    await this.wsClient.sendMessage({
                        orderId,
                        message: reply,
                        roleType: 'user'
                    });
                }

            } finally {
                this.processingLock.delete(lockKey);
            }

        } catch (err) {
            console.error('[OrderChatManager:onIncomingChatMessage] CRITICAL OrderChatManager error:', err);
        }
    }

    // ✅ Новый метод для поиска ВСЕХ подходящих ответов
    private findAllRepliesForText(text: string): string[] {
        const replies: string[] = [];
        const lowerText = text.toLowerCase();

        for (const keyword of this.keywords) {
            let matched = false;

            if (keyword.matcher instanceof RegExp) {
                matched = keyword.matcher.test(lowerText);
            } else {
                matched = lowerText.includes(keyword.matcher.toLowerCase());
            }

            if (matched) {
                const response = Array.isArray(keyword.response)
                    ? keyword.response[Math.floor(Math.random() * keyword.response.length)]
                    : keyword.response;

                replies.push(response);
            }
        }

        return replies;
    }


    /* ---------- rate limit ---------- */
    private canReplyNow(orderId: string) {
        const rate = this.loadRate();
        rate[orderId] = rate[orderId] || [];
        const now = Date.now();
        // оставляем только метки внутри последней минуты
        rate[orderId] = rate[orderId].filter(ts => now - ts < 60_000);
        const newLength = rate[orderId].length;
        this.saveRate(rate);
        const canReply = newLength < this.replyRateLimitPerMinute;
        if (!canReply) {
            console.warn(`[OrderChatManager:canReplyNow] Rate limit hit for order ${orderId}: ${newLength}/${this.replyRateLimitPerMinute} replies/min.`);
        }
        return canReply;
    }

    private pushRateTimestamp(orderId: string, ts: number) {
        const rate = this.loadRate();
        rate[orderId] = rate[orderId] || [];
        rate[orderId].push(ts);
        // trim > 100
        if (rate[orderId].length > 100) {
            rate[orderId].splice(0, rate[orderId].length - 100);
        }
        this.saveRate(rate);
    }

    /* ---------- Hook to incoming WS messages ---------- */
    private hookIncomingMessages() {
        // 1) если wsClient предоставляет подписку на события — используем её
        if (this.wsClient && typeof (this.wsClient as any).on === 'function') {
            // предполагаем, что wsClient.emit('message', parsedMessage) делает
            (this.wsClient as any).on('message', (msg: any) => {
                this.onIncomingChatMessage(msg).catch(console.error); // Оставили console.error
            });
            return;
        }

        console.warn('OrderChatManager: unable to hook into wsClient incoming messages automatically. Provide messages manually.');
    }
}