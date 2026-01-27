// src/features/buy/logic/buyTradeLogic.ts

import { showNotification } from "../../../shared/utils/notifications.ts";
import { closeModal } from "../components/buyModalDOM.ts";
import type { ApiResult, OrderPayload, CreateResponse } from "../../../shared/types/ads";
import { saveOrderAndWatch } from "./buyOrderManager.ts";
import type { Card } from "../../../shared/types/reviews";
import { editTelegramMessage } from "../../sell/api/telegramNotifier.ts";

// === Валидация и расчеты ===

export function validateAndToggleButton(amountInput: HTMLInputElement | null, tradeButton: HTMLButtonElement | null, apiResult: ApiResult): boolean {
   const amount: number = amountInput ? parseFloat(amountInput.value) : 0;
   const price: number = parseFloat(String(apiResult.price)) || 0;
   const minAmount: number = parseFloat(String(apiResult.minAmount)) || 0;
   const maxAmount: number = parseFloat(String(apiResult.maxAmount)) || 0;

   // ... (весь код валидации) ... 


   const balance: number = localStorage.getItem("curbal") ? parseFloat(localStorage.getItem("curbal")!) : 123;


   const minAmountInUSDT: number = price > 0 ? parseFloat((minAmount / price).toFixed(4)) : 0;
   const maxAmountInUSDT: number = price > 0 ? parseFloat((maxAmount / price).toFixed(4)) : 0;

   const isValid: boolean =
      (amount > 0 &&
         amount >= minAmountInUSDT &&
         amount <= maxAmountInUSDT &&
         amount <= balance)
   console.log("🚀 ~ validateAndToggleButton ~ balance:", balance)
   console.log("🚀 ~ validateAndToggleButton ~ amount:", amount)
   console.log("🚀 ~ validateAndToggleButton ~ minAmountInUSDT:", minAmountInUSDT)
   console.log("🚀 ~ validateAndToggleButton ~ maxAmountInUSDT:", maxAmountInUSDT)


   if (tradeButton) {
      tradeButton.disabled = !isValid;
      tradeButton.style.opacity = isValid ? "1" : "0.6";
      tradeButton.style.cursor = isValid ? "pointer" : "not-allowed";
   }

   return isValid;
}

export function handleAmountChange(amountInput: HTMLInputElement | null, receiveInput: HTMLInputElement | null, tradeButton: HTMLButtonElement | null, apiResult: ApiResult): void {
   if (!amountInput || !receiveInput) return;
   const price: number = parseFloat(String(apiResult.price)) || 0;
   const amount: number = parseFloat(amountInput.value) || 0;
   const receiveAmount: number = amount * price;
   receiveInput.value = receiveAmount.toFixed(2);
   validateAndToggleButton(amountInput, tradeButton, apiResult);
}

function createBuyPayload(apiResult: ApiResult, amountInput: HTMLInputElement | null): OrderPayload {
   // Используем maxAmount, если amountInput недоступен (например, в авторежиме)
   const quantity: string = amountInput
      ? parseFloat(amountInput.value).toString()
      : (parseFloat(apiResult.maxAmount) / parseFloat(apiResult.price)).toFixed(4).toString();

   const amountRUB: string = amountInput
      ? (parseFloat(amountInput.value) * parseFloat(String(apiResult.price))).toFixed(2).toString()
      : apiResult.maxAmount;

   return {
      itemId: apiResult.id,
      tokenId: "USDT",
      currencyId: "RUB",
      side: "0", // Купить
      quantity: quantity, // USDT
      amount: amountRUB, // RUB
      curPrice: apiResult.curPrice,
      flag: "amount",
      version: "1.0",
      securityRiskToken: "",
      isFromAi: false,
   };
}


// === Исполнение сделки ===

/**
 * Отправляет запрос на создание ордера и обрабатывает результат.
 */
export async function executeTrade(apiResult: ApiResult, card: Card, tradeButton: HTMLButtonElement | null, messageId?: number): Promise<void> {
   const originalText: string = tradeButton?.textContent || "";

   // ... (Логика блокировки кнопки и проверки ошибок API)
   if (tradeButton) {
      tradeButton.disabled = true;
      tradeButton.textContent = "Отправка заявки...";
      tradeButton.style.opacity = "0.6";
   }

   try {
      // Проверка ошибок, которые могут быть в apiResult
      if (apiResult.ret_code === 912100027 || apiResult.ret_code === 912300001) {
         // ... (показать уведомление и закрыть модальное окно)
         showNotification(apiResult.ret_code === 912100027 ? "The ad status of your P2P order has been changed. Please try another ad." : "Insufficient ad inventory, please try other ads.", "error");
         closeModal();
         return;
      }

      const amountInput = document.querySelector("#amount-input") as HTMLInputElement | null;
      const orderPayload: OrderPayload = createBuyPayload(apiResult, amountInput);

      const response: Response = await fetch("https://www.bybit.com/x-api/fiat/otc/order/create", {
         method: "POST",
         headers: { "Content-Type": "application/json", Accept: "application/json" },
         credentials: "include",
         body: JSON.stringify(orderPayload),
      });

      const result: CreateResponse = await response.json();

      if (response.ok && result.ret_code === 0 && card) {
         await saveOrderAndWatch(result.result.orderId, card, apiResult, amountInput); // ⭐ Вызов из buyOrderManager
         showNotification("ордер успешно создан", "success");
         closeModal();
         if (messageId) {
            await editTelegramMessage(messageId, "\n\n✅ Ордер успешно создан!");
         }

         await (window as any).wsClient.sendMessage({
            orderId: result.result.orderId,
            message: "Привет"
         });
      } else {
         showNotification(result.ret_msg || String(result), "error");
         closeModal();
         if (messageId) {
            await editTelegramMessage(messageId, "\n\n❌ Ошибка при создании ордера: " + result.ret_msg);
         }
      }
   } catch (error) {
      console.error("Ошибка при создании ордера:", error);
      if (messageId) {
         await editTelegramMessage(messageId, "\n\n❌❌ Неизвестная ошибка при создании ордера");
      }
   } finally {
      if (tradeButton) {
         tradeButton.disabled = false;
         tradeButton.textContent = originalText;
         tradeButton.style.opacity = "1";
      }
   }
}
