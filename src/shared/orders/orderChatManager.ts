// orderChatManager.ts

import { USER_ID } from "../../core/config";
import type { BybitP2PWebSocket } from "../api/wsPrivate";
import type { ChatMessageData, IncomingChatPayload, OrderData } from "../types/ads";
import { bankLatinToCyrillic } from "../utils/bankParser";

const STORAGE_KEY_PROCESSED = 'bybit_p2p_processed_msgs_v1';

// Утилитные функции вынесены из класса, так как они не зависят от инстанса
function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay() {
    return Math.random() * 1000;
}

interface KeywordMatcher {
    matcher: RegExp | string;
    response: string | string[] | ((bank: string) => string); // Добавил функцию для динамических ответов
}

export class OrderChatManager {
    private wsClient: BybitP2PWebSocket;
    private processingLock = new Set<string>();

    // Keywords теперь статичны или не зависят от this.bank напрямую в момент инициализации
    private readonly keywords: KeywordMatcher[] = [
        {
            matcher: /(?:откуда\s*(?:оплата|перевод|плат[её]ж)|как[ог]г*[ой]\s*(?:у\s*(?:вас|тебя))?\s*банк)/,
            // Передаем функцию, чтобы подставить банк в момент генерации ответа
            response: (bank) => bank
        },
        {
            matcher: /(?:лицо|личная\sкарта|кто\s*о[пт][пт]равитель)|[13]\s*л\?/,
            response: "Можно с карты родственника? лк у меня"
        },
        {
            matcher: /(?:лк\sна\sруках|лк\sу\sвас|знае(?:те|шь)|умее(?:те|шь)|подтверди(?:те|шь)|сможе(?:те|шь)|предостави(?:те|шь)|на\sпочт|работаем)/,
            response: "Да"
        },
    ];

    constructor(wsClient: any) {
        this.wsClient = wsClient;
        this.hookIncomingMessages();

        // Очистка старых данных при выгрузке (опционально)
        window.addEventListener('beforeunload', () => {
            // Можно добавить очистку старых ключей из processed/rate
        });
    }

    /* ---------- localStorage helpers ---------- */
    // Убрал loadActive/saveActive

    private loadProcessed(): Record<string, string[]> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PROCESSED);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    private saveProcessed(obj: Record<string, string[]>) {
        localStorage.setItem(STORAGE_KEY_PROCESSED, JSON.stringify(obj));
    }

    /* ---------- Logic ---------- */

    private async onIncomingChatMessage(payload: IncomingChatPayload): Promise<void> {
        try {
            if (!payload || payload.topic !== 'OTC_USER_CHAT_MSG_V2' || payload.type !== 'RECEIVE') {
                return;
            }

            const data = payload.data || {} as ChatMessageData;
            const orderId = data.orderId;
            const incomingMsgId = data.msgUuid;
            const textRaw = data.message?.toString().toLowerCase();

            // Базовые проверки
            if (!orderId || !textRaw || data.userId === USER_ID) {
                return;
            }

            // 1. Получаем данные об ордере. Если ордера нет в нашем локальном кеше — мы не можем ответить (не знаем банк).
            const orderAndCardRaw = localStorage.getItem("!orders");
            const ordersAndCards: OrderData[] = orderAndCardRaw ? JSON.parse(orderAndCardRaw) : [];
            const foundOrder = ordersAndCards.find((item) => item.order["Order No."] === orderId);

            if (!foundOrder) {
                // Если ордер не найден, мы просто игнорируем сообщение, так как не знаем контекст (банк)
                console.warn(`Ордер ${orderId} не найден в localStorage`);
                return;
            }

            // Локальная переменная для банка конкретного сообщения
            const currentBank = bankLatinToCyrillic(foundOrder.card.bank);

            // 2. Блокировка и идемпотентность
            const lockKey = `${orderId}_${incomingMsgId}`;
            if (this.processingLock.has(lockKey)) return;
            this.processingLock.add(lockKey);

            try {
                const processed = this.loadProcessed();
                processed[orderId] = processed[orderId] || [];

                if (processed[orderId].includes(incomingMsgId)) return;

                processed[orderId].push(incomingMsgId);
                // Опционально: чистить массив, если он становится слишком большим
                if (processed[orderId].length > 50) processed[orderId].shift();
                this.saveProcessed(processed);

                // 3. Поиск ответов с передачей контекста (currentBank)
                const replies = this.findAllRepliesForText(textRaw, currentBank);

                if (replies.length === 0) return;

                // 4. Отправка
                for (const reply of replies) {

                    // Имитация задержки ввода
                    await wait(randomDelay());

                    await this.wsClient.sendMessage({
                        orderId,
                        message: reply,
                        roleType: 'user' // Убрал strict типизацию для примера, верни если нужно
                    });
                }

            } finally {
                this.processingLock.delete(lockKey);
            }

        } catch (err) {
            console.error('[OrderChatManager] Error:', err);
        }
    }

    // Передаем bank как аргумент
    private findAllRepliesForText(text: string, bank: string): string[] {
        const replies: string[] = [];

        for (const keyword of this.keywords) {
            let matched = false;
            if (keyword.matcher instanceof RegExp) {
                matched = keyword.matcher.test(text);
            } else {
                matched = text.includes(keyword.matcher.toString().toLowerCase());
            }

            if (matched) {
                let responseStr: string;

                // Если response - функция, вызываем её с текущим банком
                if (typeof keyword.response === 'function') {
                    responseStr = keyword.response(bank);
                } else if (Array.isArray(keyword.response)) {
                    responseStr = keyword.response[Math.floor(Math.random() * keyword.response.length)];
                } else {
                    responseStr = keyword.response;
                }

                replies.push(responseStr);
            }
        }
        return replies;
    }

    private hookIncomingMessages() {
        if (this.wsClient && typeof (this.wsClient as any).on === 'function') {
            (this.wsClient as any).on('message', (msg: any) => {
                this.onIncomingChatMessage(msg).catch(console.error);
            });
        }
    }
}
// вид сообщения
// {
//     "userId": 279782617,
//     "orderId": "2001615416852860928",
//     "message": "Добрый день! оплата по номеру карты на сбербанк, работаем?",
//     "msgUuid": "37bb0430-a075-6b76-cd4a-def38762cec6",
//     "createDate": "1766057314963",
//     "contentType": "str",
//     "roleType": "user",
//     "id": 5299029598,
//     "msgCode": 0,
//     "onlyForCustomer": 0,
//     "nickName": "🌊Urahara",
//     "fromP2pChat": false,
//     "autoSend": false,
//     "msgUuId": "37bb0430-a075-6b76-cd4a-def38762cec6"
// }

// {
//     "userId": 204412940,
//         "orderId": "2019058790599499776",
//             "message": "лан",
//                 "msgUuid": "863970e3-f758-4db5-9ee3-0b20b97ccfd2",
//                     "createDate": "1770217310253",
//                         "contentType": "str",
//                             "roleType": "user",
//                                 "id": 5661831948,
//                                     "msgCode": 0,
//                                         "fileName": "",
//                                             "onlyForCustomer": 0,
//                                                 "nickName": "daydream1",
//                                                     "fromP2pChat": false,
//                                                         "autoSend": false,
//                                                             "msgUuId": "863970e3-f758-4db5-9ee3-0b20b97ccfd2"
// }