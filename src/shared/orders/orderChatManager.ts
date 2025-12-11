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
    console.log(`[OrderChatManager] Waiting for ${ms}ms...`);
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
    // задержка от 2 до 4 секунд
    const delay = 2000 + Math.random() * 2000;
    // console.log(`[OrderChatManager] Generated random delay: ${delay.toFixed(0)}ms`);
    return delay;
}

export class OrderChatManager {
    private wsClient: BybitP2PWebSocket;

    private bank: string = ""
    private keywords: Array<{
        matcher: RegExp | string;
        response: string | string[];
    }> = [
            { matcher: /(?:откуда\s(?:оплата|перевод|плат[её]ж)|како[ог][ой]\s(?:у\s(?:вас|тебя))?банк)/i, response: this.bank },
            { matcher: /(?:на\sпочт|работаем)/gi, response: "Да" },
            { matcher: /(?:лицо|личная\sкарта)/gi, response: "Можно с карты родственника? лк у меня" }
        ];

    private userData: Record<string, string> = {
        'payment': 'test1',
        'name': 'test2',
        'currency': 'test3'
    }; // твои данные для подстановки (например: платежка, имя, валюта)
    private replyRateLimitPerMinute = 6;

    constructor(wsClient: any) {
        this.wsClient = wsClient;
        console.log('[OrderChatManager] Initializing...');

        // Подключим слушатель входящих сообщений.
        // Если wsClient поддерживает событие (preferred), подпишемся, иначе проксируем handleMessage.
        this.hookIncomingMessages();
        // Очистка при выгрузке страницы
        window.addEventListener('beforeunload', () => {
            console.log('[OrderChatManager] beforeunload event triggered.');
            // По желанию — не удаляем active orders автоматически, пусть служат пока ордер жив.
            // Но можно удалить stale channels, если нужно:
        });
        console.log('[OrderChatManager] Initialized successfully.');
    }

    /* ---------- localStorage helpers ---------- */
    private loadActive(): Record<string, OrderChannel> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ACTIVE);
            const data = raw ? JSON.parse(raw) : {};
            // console.log(`[OrderChatManager:loadActive] Loaded ${Object.keys(data).length} active orders.`);
            return data;
        } catch (e) {
            console.error('[OrderChatManager:loadActive] Error loading active orders:', e);
            return {};
        }
    }
    private saveActive(obj: Record<string, OrderChannel>) {
        console.log(`[OrderChatManager:saveActive] Saving ${Object.keys(obj).length} active orders.`);
        localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(obj));
    }

    private loadProcessed(): Record<string, string[]> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PROCESSED);
            const data = raw ? JSON.parse(raw) : {};
            // console.log(`[OrderChatManager:loadProcessed] Loaded processed messages for ${Object.keys(data).length} orders.`);
            return data;
        } catch (e) {
            console.error('[OrderChatManager:loadProcessed] Error loading processed messages:', e);
            return {};
        }
    }
    private saveProcessed(obj: Record<string, string[]>) {
        // console.log(`[OrderChatManager:saveProcessed] Saving processed messages for ${Object.keys(obj).length} orders.`);
        localStorage.setItem(STORAGE_KEY_PROCESSED, JSON.stringify(obj));
    }

    private loadRate(): Record<string, number[]> {
        // map orderId -> timestamps (ms) of replies sent
        try {
            const raw = localStorage.getItem(STORAGE_KEY_RATE);
            const data = raw ? JSON.parse(raw) : {};
            // console.log(`[OrderChatManager:loadRate] Loaded rate limits for ${Object.keys(data).length} orders.`);
            return data;
        } catch (e) {
            console.error('[OrderChatManager:loadRate] Error loading rate limits:', e);
            return {};
        }
    }
    private saveRate(obj: Record<string, number[]>) {
        // console.log(`[OrderChatManager:saveRate] Saving rate limits for ${Object.keys(obj).length} orders.`);
        localStorage.setItem(STORAGE_KEY_RATE, JSON.stringify(obj));
    }

    /* ---------- API: старт/стоп канала для ордера ---------- */
    startForOrder(orderId: string, opponentUserId?: number | string) {
        console.log(`[OrderChatManager:startForOrder] Attempting to start channel for ${orderId}`);
        const active = this.loadActive();
        if (active[orderId]) {
            console.warn(`[OrderChatManager:startForOrder] Channel for ${orderId} is already active. Skipping.`);
            return; // уже есть
        }
        active[orderId] = { orderId, startedAt: Date.now(), opponentUserId };
        this.saveActive(active);
        console.log(`[OrderChatManager:startForOrder] Started channel for ${orderId}`);
    }

    stopForOrder(orderId: string) {
        console.log(`[OrderChatManager:stopForOrder] Attempting to stop channel for ${orderId}`);
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
        console.log(`[OrderChatManager:stopForOrder] Deleted processed messages for ${orderId}.`);

        const rate = this.loadRate();
        delete rate[orderId];
        this.saveRate(rate);
        console.log(`[OrderChatManager:stopForOrder] Deleted rate limits for ${orderId}.`);

        console.log(`[OrderChatManager:stopForOrder] Stopped channel for ${orderId}`);
    }

    isActive(orderId: string) {
        const active = this.loadActive();
        const isActive = !!active[orderId];
        // console.log(`[OrderChatManager:isActive] Order ${orderId} is active: ${isActive}`);
        return isActive;
    }
    private processingLock = new Set<string>();
    /* ---------- Основная логика обработки входящего сообщения ---------- */
    private async onIncomingChatMessage(payload: any) {
        // ожидаем структуру: { topic: 'OTC_USER_CHAT_MSG_V2', type: 'RECEIVE', data: { orderId, msgUuid?, userId, message, ... } }
        console.log('[OrderChatManager:onIncomingChatMessage] Received potential chat message payload.', payload);
        try {
            if (!payload || payload.topic !== 'OTC_USER_CHAT_MSG_V2' || payload.type !== 'RECEIVE') {
                // console.log('[OrderChatManager:onIncomingChatMessage] Not a chat message or not a RECEIVE type. Skipping.');
                return;
            }
            const data = payload.data || {};
            const orderId: string = data.orderId || data.order_id || data.otcOrderId || data.order; // сто раз встречается по-разному
            const orderAndCardRaw = localStorage.getItem("!orders")
            const ordersAndCards: OrderData[] = orderAndCardRaw ? JSON.parse(orderAndCardRaw) : {};
            const foundOrder = ordersAndCards.find((item) => item.order["Order No."] === orderId);

            if (foundOrder) {
                this.bank = bankLatinToCyrillic(foundOrder.card.bank);
                console.log(`[OrderChatManager:onIncomingChatMessage] Bank for order ${orderId} resolved to: ${this.bank}`);
                // Обновляем keywords, так как bank мог измениться
                this.keywords = [
                    { matcher: /(?:откуда\s(?:оплата|перевод|плат[её]ж)|како[ог][ой]\s(?:у\s(?:вас|тебя))?банк)/i, response: this.bank },
                ];
            } else {
                console.warn(`[OrderChatManager:onIncomingChatMessage] Order data not found for orderId: ${orderId}`);
            }

            const incomingMsgId = data.msgUuid || data.msg_id || data.msgId || data.uuid || String(Date.now());
            const textRaw = (data.message || data.text || '').toString();

            if (!orderId || !textRaw) {
                console.warn(`[OrderChatManager:onIncomingChatMessage] Missing orderId or message text. orderId: ${orderId}, textRaw: ${textRaw.substring(0, 50)}`);
                return;
            }
            console.log(`[OrderChatManager:onIncomingChatMessage] Processing message from order ${orderId}. Text: "${textRaw.substring(0, 50)}..."`);

            // Если канал не активен — ничего не делаем
            if (!this.isActive(orderId)) {
                console.log(`[OrderChatManager:onIncomingChatMessage] Channel for ${orderId} is not active. Skipping auto-reply.`);
                return;
            }

            // 🔒 БЛОКИРОВКА для предотвращения гонки
            const lockKey = `${orderId}_${incomingMsgId}`;
            if (this.processingLock.has(lockKey)) {
                console.log(`[OrderChatManager:onIncomingChatMessage] Message ${incomingMsgId} for ${orderId} is already locked/processing. Skipping.`);
                return;
            }
            this.processingLock.add(lockKey);
            console.log(`[OrderChatManager:onIncomingChatMessage] Acquired lock for ${lockKey}.`);

            try {
                // ✅ ВСЕ ПРОВЕРКИ И ЗАПИСИ СИНХРОННО
                const processed = this.loadProcessed();
                processed[orderId] = processed[orderId] || [];
                if (processed[orderId].includes(incomingMsgId)) {
                    console.log(`[OrderChatManager:onIncomingChatMessage] Message ${incomingMsgId} for ${orderId} is a known duplicate. Skipping.`);
                    return; // дубликат
                }
                processed[orderId].push(incomingMsgId);
                this.saveProcessed(processed);
                console.log(`[OrderChatManager:onIncomingChatMessage] Message ${incomingMsgId} for ${orderId} marked as processed.`);

                // ✅ Rate limit проверяем И РЕЗЕРВИРУЕМ место сразу
                if (!this.canReplyNow(orderId)) {
                    console.warn(`[OrderChatManager:onIncomingChatMessage] Rate limit exceeded for order ${orderId}. Skipping reply.`);
                    return;
                }
                this.pushRateTimestamp(orderId, Date.now()); // ← СРАЗУ резервируем
                console.log(`[OrderChatManager:onIncomingChatMessage] Rate limit check passed for ${orderId}. Timestamp reserved.`);

                // ✅ Находим ответ
                const reply = this.findReplyForText(textRaw);
                if (!reply) {
                    console.log(`[OrderChatManager:onIncomingChatMessage] No keyword matched in message for order ${orderId}. Skipping reply.`);
                    return;
                }

                const finalReply = this.interpolate(reply, this.userData);
                console.log(`[OrderChatManager:onIncomingChatMessage] Found reply for ${orderId}: "${finalReply}".`);

                // ⏰ ТЕПЕРЬ ждём (все проверки уже прошли)
                await wait(randomDelay());
                console.log(`[OrderChatManager:onIncomingChatMessage] Wait finished for ${orderId}. Preparing to send.`);

                // 📤 Отправляем
                await this.wsClient.sendMessage({
                    orderId,
                    message: finalReply,
                    roleType: 'user'
                });

                console.log(`[OrderChatManager:onIncomingChatMessage] Auto-reply SENT to order ${orderId}: "${finalReply}"`);

            } finally {
                this.processingLock.delete(lockKey);
                console.log(`[OrderChatManager:onIncomingChatMessage] Released lock for ${lockKey}.`);
            }

        } catch (err) {
            console.error('[OrderChatManager:onIncomingChatMessage] CRITICAL OrderChatManager error:', err);
        }
    }

    /* ---------- Вспомогательные методы ---------- */
    private normalize(text: string) {
        const normalized = text.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
        // console.log(`[OrderChatManager:normalize] Original: "${text.substring(0, 30)}...", Normalized: "${normalized.substring(0, 30)}..."`);
        return normalized;
    }

    private findReplyForText(text: string): string | null {
        console.log(`[OrderChatManager:findReplyForText] Searching for reply in text: "${text.substring(0, 30)}..."`);
        const norm = this.normalize(text);
        const words = new Set(norm.split(' ').filter(Boolean));

        for (const { matcher, response } of this.keywords) {
            let matched = false;
            const matcherType = matcher instanceof RegExp ? 'RegExp' : 'String';

            if (matcher instanceof RegExp) {
                // Для regex проверяем оригинальный текст (не нормализованный)
                matched = matcher.test(text);
                // console.log(`[OrderChatManager:findReplyForText] Testing RegExp /${matcher.source}/i. Match: ${matched}`);
            } else {
                // Для строки используем старую логику
                const key = matcher.toLowerCase();
                if (key.includes(' ')) {
                    matched = norm.includes(key);
                    // console.log(`[OrderChatManager:findReplyForText] Testing multi-word key "${key}". Match: ${matched}`);
                } else {
                    matched = words.has(key);
                    // console.log(`[OrderChatManager:findReplyForText] Testing single-word key "${key}". Match: ${matched}`);
                }
            }

            if (matched) {
                console.log(`[OrderChatManager:findReplyForText] Matched with ${matcherType}: ${matcher.toString()}`);
                return Array.isArray(response) ? this.pick(response) : response;
            }
        }
        console.log('[OrderChatManager:findReplyForText] No matcher found.');
        return null;
    }

    private pick(arr: string[] | string) {
        if (Array.isArray(arr)) {
            const idx = Math.floor(Math.random() * arr.length);
            const reply = arr[idx];
            // console.log(`[OrderChatManager:pick] Picked random reply (index ${idx}/${arr.length-1}): "${reply}"`);
            return reply;
        }
        // console.log(`[OrderChatManager:pick] Response is single string: "${arr}"`);
        return arr;
    }

    private interpolate(template: string, data: Record<string, string>) {
        // подставляет {key} => data[key] если есть
        const result = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => (data[k] ?? `{${k}}`));
        // console.log(`[OrderChatManager:interpolate] Interpolated template: "${template}" to "${result}"`);
        return result;
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
        // console.log(`[OrderChatManager:canReplyNow] Order ${orderId}: ${newLength} replies in the last minute (max ${this.replyRateLimitPerMinute}). Can reply: ${canReply}`);
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
            console.log(`[OrderChatManager:pushRateTimestamp] Trimmed rate limit array for ${orderId} to 100 entries.`);
        }
        this.saveRate(rate);
        // console.log(`[OrderChatManager:pushRateTimestamp] Pushed timestamp for ${orderId}. Total: ${rate[orderId].length}`);
    }

    /* ---------- Hook to incoming WS messages ---------- */
    private hookIncomingMessages() {
        console.log('[OrderChatManager:hookIncomingMessages] Attempting to hook into WS messages...');
        // 1) если wsClient предоставляет подписку на события — используем её
        if (this.wsClient && typeof (this.wsClient as any).on === 'function') {
            // предполагаем, что wsClient.emit('message', parsedMessage) делает
            (this.wsClient as any).on('message', (msg: any) => {
                console.log('[OrderChatManager:hookIncomingMessages] WS event "message" received. Calling handler.');
                this.onIncomingChatMessage(msg).catch(console.error);
            });
            console.log('[OrderChatManager:hookIncomingMessages] Successfully hooked using wsClient.on("message").');
            return;
        }

        // 2) иначе мы попытаемся "проксировать" оригинальный обработчик handleMessage:
        //    заменим метод wsClient.handleMessage на обёртку, чтобы получать приходящие сообщения
        const target = this.wsClient as any;
        if (target && typeof target.handleMessage === 'function') {
            const orig = target.handleMessage.bind(target);
            const self = this;
            target.handleMessage = function (data: any) {
                console.log('[OrderChatManager:hookIncomingMessages] Intercepted wsClient.handleMessage.');
                // пытаемся парсить если пришла строка
                try {
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    // call manager handler (не ждём завершения)
                    console.log('[OrderChatManager:hookIncomingMessages] Calling onIncomingChatMessage (proxy method).');
                    self.onIncomingChatMessage(parsed).catch(console.error);
                } catch (err) {
                    // если не JSON — всё равно вызвать оригинальный
                    console.warn('[OrderChatManager:hookIncomingMessages] Data is not JSON string. Calling original handler only.');
                }
                // вызвать оригинал (чтобы не ломать логику)
                return orig(data);
            };
            console.log('[OrderChatManager:hookIncomingMessages] Successfully hooked into wsClient.handleMessage (proxy).');
            return;
        }

        console.warn('OrderChatManager: unable to hook into wsClient incoming messages automatically. Provide messages manually.');
    }
}