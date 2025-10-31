// src/features/buy/components/BuyModal.ts

import { disableBodyScroll } from "../../../shared/utils/domHelpers.ts";

import { fetchAdDetailsAndSetupEvents } from "../logic/buyModalProcessor.ts"; // ⭐ НОВЫЙ ИМПОРТ
import { setupInitialModalEvents, closeModal, createModalHTML } from "./buyModalDOM.ts"; // ⭐ НОВЫЙ ИМПОРТ

import type { Ad } from "../../../shared/types/ads";
import type { Card } from "../automation/adFinder.ts";
import { startPriceTimer } from "../../../shared/utils/timeStuff.ts";
import { loadAndDisplayReviews } from "../../reviews/components/reviewDisplay.ts";


export async function openBuyModal(data: { ad: Ad; card: Card | null }, minPrice: number, autoarbitrage: boolean): Promise<void> {
   const ad = data.ad;

   if (!ad) return;

   // 1. --- создаем модальное окно только в мануальном режиме ---
   if (!autoarbitrage) {
      disableBodyScroll();
      closeModal(); // Удаляем старое, если есть

      const overlay = createModalHTML(ad); // ⭐ Вынесено в DOM-утилиту
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";

      // Запускаем асинхронную загрузку отзывов
      loadAndDisplayReviews(ad);
      startPriceTimer();

      // Привязываем события закрытия/blur (остается в компонентах, т.к. связано с DOM)
      setupInitialModalEvents(overlay); // ⭐ Вынесено в DOM-утилиту
   }

   // 2. --- ФАЗА ФОНОВОЙ ЗАГРУЗКИ И ОБНОВЛЕНИЯ ---
   // Вся сложная логика загрузки API, поиска карт, обработки ошибок и настройки trade-событий вынесена
   await fetchAdDetailsAndSetupEvents(data, minPrice, autoarbitrage);
}
