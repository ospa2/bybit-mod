// src/features/buy/logic/buyModalProcessor.ts

import { showNotification } from "../../../shared/utils/notifications.ts";

import { closeModal } from "../components/buyModalDOM.ts";
import { validateAndToggleButton, handleAmountChange, executeTrade } from "./buyTradeLogic.ts"; // ⭐ НОВЫЙ ИМПОРТ

import type { Ad, ApiResult } from "../../../shared/types/ads";
import { fetchAdDetails } from "../api/buyApi.ts";
import type { Card } from "../../../shared/types/reviews";
import { findBuyCard } from "../automation/buyAdSelector.ts";
import { sendTelegramMessage } from "../../sell/api/confirmOrder.ts";
import { updateMaxAmount } from "../../../shared/utils/bankParser.ts";


/**
 * 1. Загружает детали объявления через API.
 * 2. Ищет подходящую карту (если нужно).
 * 3. Настраивает все интерактивные события модального окна.
 */
export async function fetchAdDetailsAndSetupEvents(
   data: { ad: Ad; card: Card | null },
   minPrice: number,
   autoarbitrage: boolean
): Promise<void> {
   try {
      // --- 1. ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ДАННЫХ И ВАЛИДАЦИЯ ---
      const apiResultRaw = await fetchAdDetails(data.ad);
      let apiResult = updateMaxAmount(apiResultRaw)
      if (apiResult.ret_code !== 0) {
         showNotification(apiResult.ret_msg || "Не удалось загрузить детали объявления.", "error");
         closeModal();
         return;
      }


      // --- 2. ПОИСК КАРТЫ ---
      if (data.card === null && minPrice) {
         // ⭐ Вызов из buyCardSelector
         data.card = findBuyCard(data.ad, minPrice);
      }

      // --- 3. НАСТРОЙКА ИНТЕРФЕЙСА / АВТОМАТИЗАЦИЯ ---
      if (data) {
         setupTradeEvents(apiResult, data, autoarbitrage);
      } else {
         showNotification("нет подходящей карты под это объявление", "error");
         closeModal();
      }
   } catch (e) {
      console.error("Ошибка при подгрузке деталей объявления:", e);
      showNotification("Ошибка при подгрузке деталей. Попробуйте снова.", "error");
      closeModal();
   }
}
const clickedAds = new Set<string>();
/**
 * Привязывает логику к кнопкам и полям ввода модального окна.
 */
function setupTradeEvents(apiResult: ApiResult, data: { ad: Ad; card: Card | null }, autoarbitrage: boolean): void {
   const overlay = document.querySelector(".bybit-modal-overlay") as HTMLElement | null;
   const card = data.card;
   const ad = data.ad;
   // ... получение всех элементов DOM (amountInput, receiveInput, tradeButton, maxButton)
   const amountInput = overlay?.querySelector("#amount-input") as HTMLInputElement | null;
   const receiveInput = overlay?.querySelector("#receive-input") as HTMLInputElement | null;
   const tradeButton = overlay?.querySelector("#trade-button") as HTMLButtonElement | null;
   const maxButton = overlay?.querySelector("#max-button") as HTMLButtonElement | null;

   const price: number = parseFloat(String(apiResult.price)) || 0;

   // === Ручной режим ===
   if (!autoarbitrage) {
      // ... (логика ручного режима остается без изменений)
      amountInput?.addEventListener("input", () => handleAmountChange(amountInput, receiveInput, tradeButton, apiResult));

      receiveInput?.addEventListener("input", () => {
         // Логика конвертации RUB -> USDT (USD)
         if (!amountInput || !receiveInput) return;
         const receiveValue: number = parseFloat(receiveInput.value) || 0;
         const amountValue: number = price > 0 ? receiveValue / price : 0;
         amountInput.value = amountValue.toFixed(4);
         validateAndToggleButton(amountInput, tradeButton, apiResult); // ⭐ Вынесено в TradeLogic
      });

      maxButton?.addEventListener("click", () => {
         const maxAmountInUSDT: number = Math.min(
            parseFloat(String(apiResult.maxAmount)) / parseFloat(String(apiResult.price)) || 0
         );
         if (amountInput) {
            amountInput.value = maxAmountInUSDT.toFixed(4);
         }
         handleAmountChange(amountInput, receiveInput, tradeButton, apiResult);
      });
      if (card) {
         tradeButton?.addEventListener("click", () => executeTrade(apiResult, card, tradeButton));
      }
      maxButton?.click(); // Инициализация
      return;
   }

   // === Автоматический режим (Auto Arbitrage) ===
   const maxAmountInUSDT: number = Math.min(
      parseFloat(String(apiResult.maxAmount)) / parseFloat(String(apiResult.price)) || 0
   );
   if (amountInput) {
      amountInput.value = maxAmountInUSDT.toFixed(4);
   }

   handleAmountChange(amountInput, receiveInput, tradeButton, apiResult);

   // --- Измененная логика проверки уникальности ---
   const uniqueKey = `${ad.id}_${apiResult.price}_${apiResult.maxAmount}`;

   if (card && !clickedAds.has(uniqueKey)) {
      sendTelegramMessage(ad, card, apiResult);
      clickedAds.add(uniqueKey);
   }
   // -----------------------------------------------
}