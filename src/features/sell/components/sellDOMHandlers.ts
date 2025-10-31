// src/features/sell/components/sellDOMHandlers.ts

import { handleModalOpening } from "../components/sellModal"; // Предполагаем, что компонент модального окна продажи
import { getRowIndex } from "../../../shared/utils/domHelpers";
import type { Ad } from "../../../shared/types/ads";

let currentButtonClickHandler: ((e: MouseEvent) => void) | null = null;

/**
 * Настраивает слушатель кликов на кнопки "Продать USDT".
 */
export function setupSellButtonListener(onlineAdsData: Ad[]): void {
   // Удаляем старый обработчик, чтобы избежать дублирования

   if (currentButtonClickHandler) {
      document.removeEventListener("click", currentButtonClickHandler);
   }

   currentButtonClickHandler = (e: MouseEvent) => {
      
      const btn = (e.target as HTMLElement).closest("button");

      if (btn && btn.innerText.includes("Продать USDT")) {
         const index = getRowIndex(btn);

         if (index !== -1 && onlineAdsData[index]) {
            handleModalOpening(onlineAdsData[index], e);
         }
      }
   };

   document.addEventListener("click", currentButtonClickHandler);
}