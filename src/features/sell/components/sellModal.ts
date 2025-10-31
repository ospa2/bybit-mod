// src/features/modalHandler.ts

import { loadAndDisplayReviews } from "../../reviews/components/reviewDisplay.ts"; // предполагаемый путь
import type { Ad } from "../../../shared/types/ads";
import { getRowIndex } from "../../../shared/utils/domHelpers";
import { appState } from "../../../core/state";

export function handleModalOpening(ad: Ad, e: MouseEvent) {
  const btn = (e.target as HTMLElement)?.closest("button");
  if (btn && btn.innerText.includes("Продать USDT")) {
    const index = getRowIndex(btn);
    console.log("Клик по кнопке в строке №", index, btn.closest("tr"));
    // Альтернативный вариант - если нужно вставить в определенное место внутри модала
    const reviewsInterval = setInterval(() => {
      const modal = document.querySelector(
        '[role="dialog"], [aria-modal="true"]'
      ) as HTMLElement;

      if (modal) {
        appState.counterpartyNickname = modal.querySelector(".advertiser-name")?.textContent || "Unknown";
        // Заменяем стиль width на w-full
        modal.style.width = ""; // Убираем inline width
        modal.classList.remove(
          ...Array.from(modal.classList).filter(
            (cls) => cls.includes("width") || cls.includes("w-")
          )
        );
        modal.classList.add("w-full");

        let reviewsContainer = document.getElementById("reviews-container");

        if (!reviewsContainer) {
          reviewsContainer = document.createElement("div");
          reviewsContainer.className = "terms-content";
          reviewsContainer.id = "reviews-container";
          reviewsContainer.style.marginTop = "20px";
          reviewsContainer.innerHTML =
            '<div class="spinner">Загружаем отзывы...</div>';

          // Ищем конкретный элемент внутри модала (например, форму или кнопки)
          const insertTarget =
            modal.querySelector("form, .modal-footer, .button-group") ||
            modal.querySelector(
              '.modal-content, .modal-body, [class*="content"]'
            ) ||
            modal;

          // Вставляем перед найденным элементом или в конец
          if (insertTarget && insertTarget.parentNode) {
            insertTarget.parentNode.insertBefore(
              reviewsContainer,
              insertTarget
            );
          } else {
            modal.appendChild(reviewsContainer);
          }
        }

        loadAndDisplayReviews(ad);
        clearInterval(reviewsInterval);
        console.log("отзывы вставлены, стиль обновлен");
      }
    }, 100);
  }
}
