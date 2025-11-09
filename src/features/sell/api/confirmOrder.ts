import type { Ad, OrderPayload } from "../../../shared/types/ads";
import { findSellCard } from "../../buy/automation/adFinder";
import { AutoClickElements } from "../automation/autoсlicker";


const TELEGRAM_BOT_TOKEN = '8275350971:AAHt9lHxoe441wA4mfQIm9kUc-vJ769s00M';
const TELEGRAM_CHAT_ID = '1233363326';

export async function sendTelegramMessage(ad: Ad) {
   // 1. Создаем новый объект OrderPayload на основе данных из ad
   const payload: OrderPayload = {
      itemId: ad.id, // Предполагаем, что itemId - это id из Ad
      tokenId: ad.tokenId,
      currencyId: ad.currencyId,
      side: ad.side === 0 ? 'BUY' : 'SELL', // Примерное преобразование number в string
      quantity: ad.quantity,
      amount: ad.maxAmount, // Или ad.minAmount, или ad.price - вы должны знать, что сюда класть
      curPrice: ad.price,
      flag: "1", // Этих данных нет в Ad, вы должны указать их
      version: String(ad.version), // Преобразование number в string
      securityRiskToken: "", // Этих данных нет в Ad
      isFromAi: false // Этих данных нет в Ad
   };

   // 2. Передаем в функцию *правильный* объект
   const card = findSellCard(payload);

   const text =
      `🔥 Найден ордер на продажу\n\n` +
      `👤 Продавец: ${ad.nickName}\n` +
      `💰 Сумма: ${ad.maxAmount} ₽\n` +
      `💵 Цена: ${ad.price} ₽\n\n` +
      `📝 Описание:\n${ad.remark}\n\n` +
      `    карта: ${card?.id}\n\n` +
      `❓ Создать ордер?`;


   await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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
}

let lastUpdateId = 0;

export async function checkTelegramResponse() {
   try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
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

            if (action === "confirm_yes") {
               console.log("✅ Подтверждение — создаем ордер");
               await answerCallback(callbackId, "Ордер создан ✅");
               const dialog = document.querySelector('div[role="dialog"]') as HTMLElement;

               if (dialog && (window as any).autoClicker) {
                  AutoClickElements.runSequentialActionsToCreateOrder((window as any).autoClicker, dialog);
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
