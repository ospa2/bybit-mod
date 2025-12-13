import type { Ad, ApiResult, OrderPayload } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { executeTrade } from "../../buy/logic/buyTradeLogic";
import { AutoClickElements } from "../automation/autoсlicker";
import { findSellCard } from "../automation/sellCardSelector";


const TELEGRAM_BOT_TOKEN = '8275350971:AAHt9lHxoe441wA4mfQIm9kUc-vJ769s00M';
const TELEGRAM_CHAT_ID = '1233363326';

// Хранилище данных для каждого сообщения
const messageDataStore = new Map<number, { apiResult: ApiResult, card: Card, baseText: string }>();

function setMessageData(messageId: number, apiResult: ApiResult, card: Card, baseText: string) {
   messageDataStore.set(messageId, { apiResult, card, baseText });
}

function getMessageData(messageId: number) {
   return messageDataStore.get(messageId);
}

function deleteMessageData(messageId: number) {
   messageDataStore.delete(messageId);
}

export async function sendTelegramMessage(ad: Ad, card?: Card, apiResult?: ApiResult) {
   const payload: OrderPayload = {
      itemId: ad.id,
      tokenId: ad.tokenId,
      currencyId: ad.currencyId,
      side: ad.side === 0 ? 'BUY' : 'SELL',
      quantity: ad.quantity,
      amount: ad.maxAmount,
      curPrice: ad.price,
      flag: "1",
      version: String(ad.version),
      securityRiskToken: "",
      isFromAi: false
   };

   if (ad.side === 0) {
      // продажа
      const card = findSellCard(payload, ad.remark);

      let poNomeruKarti = false

      const regex = new RegExp(/(?:номер[уа]?\s?)?карт(?!\sне)/g);
      poNomeruKarti = regex.test(ad.remark);

      const baseText =
         `🟥 Сумма: ${ad.maxAmount} ₽\n` +
         `🟥 Цена: ${ad.price} ₽\n\n` +
         `🟥 Покупатель: ${ad.nickName}\n` +
         `🟥 Описание:\n${ad.remark}\n\n` +
         `${card ? `${card.bank === "sber" ? "🟢" : "🟡"} по ${poNomeruKarti ? "номеру карты; " : "сбп; "} баланс (${card.balance}₽)` : `🟥 Подходящая карта не нашлась`}\n\n`;

      const text = baseText + `❓ Создать ордер?`;

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            reply_markup: {
               inline_keyboard: [
                  [
                     { text: "✅ Да", callback_data: "confirm_yes" },
                     { text: "❌ Нет", callback_data: "confirm_no" }
                  ]
               ]
            }
         })
      });

      const data = await response.json();
      const messageId = data.result.message_id;

      // Сохраняем данные для этого сообщения (даже для продажи, для единообразия)
      if (card) {
         setMessageData(messageId, {} as ApiResult, card, baseText);
      }

      return messageId;

   } else if (ad.side === 1) {
      //покупка
      const baseText =        
         `🟩 Сумма: ${ad.maxAmount} ₽\n` +
         `🟩 Цена: ${ad.price} ₽\n\n` +
         `🟩 Продавец: ${ad.nickName}\n` +
         `🟩 Описание:\n${ad.remark}\n\n` +
         `${card ? `${card.bank === "sber" ? "🟢" : "🟡"} Карта: ${card.id}; баланс (${card.balance}₽)` : `🟩 Подходящая карта не нашлась`}\n\n`;

      const text = baseText

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            reply_markup: {
               inline_keyboard: [
                  [
                     { text: "✅ Создать ордер", callback_data: "confirm_yes" },
                  ]
               ]
            }
         })
      });

      const data = await response.json();
      const messageId = data.result.message_id;
      if (apiResult) {
         apiResult.maxAmount = ad.maxAmount
         apiResult.maxQuantity = (parseFloat(ad.quantity) / parseFloat(ad.maxAmount)).toFixed(4);
      }
      // Сохраняем данные для этого конкретного сообщения
      if (apiResult && card) {
         setMessageData(messageId, apiResult, card, baseText);
      }

      return messageId;
   }
}

// Упрощенная функция редактирования
export async function editTelegramMessage(messageId: number, newText: string) {
   const messageData = getMessageData(messageId);
   const baseText = messageData?.baseText || "";
   const text = baseText + newText;

   await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         chat_id: TELEGRAM_CHAT_ID,
         message_id: messageId,
         text: text
      })
   });
}

let lastUpdateId = 0;

export async function checkTelegramResponse() {
   try {
      const allowed = encodeURIComponent(JSON.stringify(["message", "callback_query"]));
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&allowed_updates=${allowed}`);
      const data = await res.json();

      if (!data.ok) {
         console.warn("Telegram API error:", data);
         return;
      }

      if (!data.result || !Array.isArray(data.result)) return;

      for (const update of data.result) {
         lastUpdateId = update.update_id;

         if (update.callback_query) {
            const action = update.callback_query.data;
            const callbackId = update.callback_query.id;
            const messageId = update.callback_query.message.message_id;

            // Получаем данные для конкретного сообщения
            const messageData = getMessageData(messageId);

            if (action === "confirm_yes") {
               console.log("✅ Подтверждение — создаем ордер");
               await answerCallback(callbackId, "Пару секунд...");
               await editTelegramMessage(messageId, "\n\n⏳ Создаю ордер...");

               const messageText = update.callback_query.message.text;

               if (messageText.includes("🟥 Найден ордер на продажу")) {
                  if ((window as any).autoClicker) {
                     AutoClickElements.clickLastButton((window as any).autoClicker, messageId);
                  } else {
                     console.log("AutoClick: диалог или экземпляр autoClicker не найден");
                  }
               } else {
                  // Покупка - используем данные из конкретного сообщения
                  if (messageData) {
                     const { apiResult, card } = messageData;
                     executeTrade(apiResult, card, null, messageId);
                  } else {
                     console.error("Данные для сообщения не найдены:", messageId);
                     await editTelegramMessage(messageId, "\n\n❌ Ошибка: данные не найдены");
                  }
               }

               // Опционально: удаляем данные после использования
               // deleteMessageData(messageId);

            } else if (action === "confirm_no") {
               console.log("❌ Отменено пользователем");
               const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
               if (dialog && (window as any).autoClicker) {
                  AutoClickElements.findAndClickCancel((window as any).autoClicker);
               } else {
                  console.log("AutoClick: диалог или экземпляр autoClicker не найден");
               }
               await answerCallback(callbackId, "Отменено ❌");

               // Удаляем данные отмененного сообщения
               deleteMessageData(messageId);
            }
         }
      }
   } catch (err) {
      console.error("Ошибка при получении апдейтов Telegram:", err);
   }
}
async function answerCallback(callbackQueryId: any, text: string) {
   await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
         callback_query_id: callbackQueryId,
         text: text,
         show_alert: false
      })
   });
}