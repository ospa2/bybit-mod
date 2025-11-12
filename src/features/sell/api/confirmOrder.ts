import type { Ad, OrderPayload } from "../../../shared/types/ads";
import { AutoClickElements } from "../automation/autoсlicker";
import { findSellCard } from "../automation/sellCardSelector";


const TELEGRAM_BOT_TOKEN = '8275350971:AAHt9lHxoe441wA4mfQIm9kUc-vJ769s00M';
const TELEGRAM_CHAT_ID = '1233363326';

// Глобальная переменная для хранения базового текста сообщения
let currentMessageBase = "";

export function setCurrentMessageBase(value: string) {
   currentMessageBase = value;
}

export function getCurrentMessageBase() {
   return currentMessageBase;
}

export async function sendTelegramMessage(ad: Ad) {
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

   const card = findSellCard(payload);

   // Сохраняем базовую часть сообщения
   currentMessageBase =
      `🔥 Найден ордер на продажу\n\n` +
      `👤 Продавец: ${ad.nickName}\n` +
      `💰 Сумма: ${ad.maxAmount} ₽\n` +
      `💵 Цена: ${ad.price} ₽\n\n` +
      `📝 Описание:\n${ad.remark}\n\n` +
      `    ${card ? `🎯 Карта: ${card.id}, баланс (${card.balance}₽)` : `  Подходящая карта не нашлась`}\n\n`;
   const text = currentMessageBase + `❓ Создать ордер?`;
   
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
   return data.result.message_id;
}

// Упрощенная функция редактирования - принимает только messageId и новый текст
export async function editTelegramMessage(messageId: number, newText: string) {
   const text = getCurrentMessageBase() + newText;
   console.log("🚀 ~ editTelegramMessage ~ getCurrentMessageBase:", getCurrentMessageBase())

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

      // если сервер вернул ошибку — пропускаем
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
            const messageId = update.callback_query.message.message_id
            setCurrentMessageBase(update.callback_query.message.text);
            if (action === "confirm_yes") {
               console.log("✅ Подтверждение — создаем ордер");
               await answerCallback(callbackId, "Пару секунд...");
               await editTelegramMessage(messageId, "\n\n⏳ Создаю ордер...");



               if ((window as any).autoClicker) {
                  AutoClickElements.runSequentialActionsToCreateOrder((window as any).autoClicker, messageId);
               } else {
                  console.log("AutoClick: диалог или экземпляр autoClicker не найден");
               }


            } else if (action === "confirm_no") {
               console.log("❌ Отменено пользователем");
               const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;
               if (dialog && (window as any).autoClicker) {
                  AutoClickElements.findAndClickCancel((window as any).autoClicker, dialog);
               } else {
                  console.log("AutoClick: диалог или экземпляр autoClicker не найден");
               }
               await answerCallback(callbackId, "Отменено ❌");
            }
         }
      }
   } catch (err) {
      console.error("Ошибка при получении апдейтов Telegram:", err);
   }
}


export async function answerCallback(callbackQueryId: any, text: string) {
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