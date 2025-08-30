import "./style.css";
import { initSliderReplacement } from "C:/Web/bybitmod/bybit-mod/src/components/rangeSlider.js";
import { updateGlobalValues } from "./state.js";
import {
  loadAllPagesSequentially,
  observeUrlChanges,
  handleUrlChange,
} from "./logic/loader.js";
import { filterRemark } from "./utils/formatters.js";
import { adShouldBeFiltered } from "./logic/adFilter.js";
import { loadAndDisplayReviews } from "./components/review.js";

function waitForTableAndStart() {
  const tbody = document.querySelector(".trade-table__tbody");

  if (!tbody || tbody.children.length === 0) {
    console.log("Ожидание таблицы...");
    setTimeout(waitForTableAndStart, 500);
  } else {
    tbody.querySelectorAll(".dynamic-row").forEach((row) => row.remove());
    tbody.querySelector(".completion-indicator")?.remove();
    document.addEventListener("keydown", (event) => {
      // Проверяем, что нажата клавиша 'Z' (без учета регистра)
      if (
        event.key === "z" ||
        event.key === "Z" ||
        event.key === "я" ||
        event.key === "Я"
      ) {
        handleUrlChange();
      }
    });

    setTimeout(() => {
      initSliderReplacement({
        min: 9000,
        max: 80000,
        onUpdate: updateGlobalValues,
      });

      loadAllPagesSequentially();
      observeUrlChanges();
      document
        .querySelectorAll(".trade-table__tbody tr")
        .forEach((row) => row.classList.add("filtered-ads"));
    }, 100);
  }
}

setTimeout(waitForTableAndStart, 100);
console.log("Bybit P2P Filter Enhanced загружен");

const originalFetch = window.fetch;

// Объявляем обработчик глобально, чтобы можно было его удалить
// Объявляем обработчик глобально, чтобы можно было его удалить
let currentButtonClickHandler = null;

window.fetch = async (...args) => {
  // args[0] — URL, args[1] — опции (method, body и т.д.)
  let shouldIntercept = false;
  
  if (args[0].includes("/x-api/fiat/otc/item/online") && args[1]?.body) {
    try {
      const body = JSON.parse(args[1].body);
      if (body.side === "0") {
        shouldIntercept = true;
      }
    } catch (e) {
      console.warn("Не удалось распарсить body:", args[1].body);
    }
  }
  
  const response = await originalFetch(...args);
  
  if (shouldIntercept) {
    response
      .clone()
      .json()
      .then((data) => {
        const ads = data.result.items;
        document
          .querySelectorAll(".trade-table__tbody tr")
          .forEach((row, i) => {
            if (adShouldBeFiltered(ads[i])) {
              row.classList.add("filtered-ad");
              return;
            }
            
            // Создаем новый td элемент
            const newTd = document.createElement("td");
            newTd.style.width = "100px";
            newTd.style.padding = "12px";
            
            // Добавляем Lorem ipsum текст
            newTd.innerHTML = `
              <div class="lorem-content">
                <p style="margin: 0; width: 300px; font-size: 14px; line-height: 1.4; color: #666;">
                  ${filterRemark(ads[i].remark)}
                </p>
              </div>
            `;
            
            // Добавляем новый td на индекс 1 (после первой ячейки)
            if (row.children.length > 5) {
              row.children[1].remove();
            }
            const secondCell = row.children[1];
            if (secondCell && row.children.length <= 5) {
              row.insertBefore(newTd, secondCell);
            }
          });
        
        console.log("Перехватил ответ /online с side=1:", data);
        window.__bybitOnlineData = data; // сохраним глобально
        
        // Удаляем старый обработчик (если он был)
        if (currentButtonClickHandler) {
          document.removeEventListener("click", currentButtonClickHandler);
        }
        
        // Создаем новый обработчик
        currentButtonClickHandler = function handleButtonClick(e) {
          const btn = e.target.closest("button");
          if (btn && btn.innerText.includes("Продать USDT")) {
            const index = getRowIndex(btn);
            console.log("Клик по кнопке в строке №", index, btn.closest("tr"));
            
            // Ждем немного, чтобы модальное окно успело открыться
            setTimeout(() => {
              // Ищем модальное окно (может быть разные селекторы)
              const modal = document.querySelector('[data-testid="advertiser-remark"]') || 
                           document.querySelector('.advertiser-remark') ||
                           document.querySelector('#advertiser-remark') ||
                           document.querySelector('[class*="modal"]') ||
                           document.querySelector('[class*="dialog"]');
              
              if (modal) {
                // Проверяем, есть ли уже контейнер для отзывов
                let reviewsContainer = document.getElementById('reviews-container');
                
                if (!reviewsContainer) {
                  // Создаем контейнер для отзывов
                  reviewsContainer = document.createElement("div");
                  reviewsContainer.className = "terms-content";
                  reviewsContainer.id = "reviews-container";
                  reviewsContainer.innerHTML = '<div class="spinner">Загружаем отзывы...</div>';
                  
                  // Добавляем в модальное окно
                  modal.appendChild(reviewsContainer);
                }
                
                // Загружаем отзывы
                loadAndDisplayReviews(ads[index]);
              } else {
                console.warn("Модальное окно не найдено");
              }
            }, 4000); // Небольшая задержка для открытия модального окна
          }
        };
        
        // Добавляем новый обработчик
        document.addEventListener("click", currentButtonClickHandler);
      });
  }
  
  return response;
};

function getRowIndex(btn) {
  const row = btn.closest("tr"); // ищем строку, где кнопка
  const rows = [...document.querySelectorAll("tr")].filter((r) =>
    r.querySelector("button span")?.textContent.includes("Продать USDT")
  );
  return rows.indexOf(row);
}