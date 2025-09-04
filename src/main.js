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
        const ads = data.result.items || [];
  // Попытка загрузить статистику из localStorage один раз
  let storedStats = [];
  try {
    const raw = localStorage.getItem('reviewsStatistics_v1');
    storedStats = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(storedStats)) storedStats = [];
  } catch (err) {
    console.warn('Не удалось прочитать reviewsStatistics_v1 из localStorage:', err);
    storedStats = [];
  }

  document.querySelectorAll(".trade-table__tbody tr").forEach((row, i) => {
    const ad = ads[i];
    if (!ad) return; // защититься от рассинхрона длины списков

    if (adShouldBeFiltered(ad)) {
      row.classList.add("filtered-ad");
      return;
    }

    // Создаем новый td элемент
    const newTd = document.createElement("td");
    newTd.style.width = "100px";
    newTd.style.padding = "12px";

    // Получаем статистику для текущего userId (строка/число — сравниваем как строки)
    const stat = storedStats.find(s => String(s.userId) === String(ad.userId));

    // Формируем базовый контент (remark)
    let inner = `
      <div class="lorem-content">
        <p style="margin: 0; width: 300px; font-size: 14px; line-height: 1.4; color: #666;">
          ${filterRemark(ad.remark)}
        </p>
      </div>
    `;

    // Если есть статистика — добавляем её под remark
    if (stat) {
      // безопасно достаём поля, которые могут отсутствовать
      const highlightedCount = stat.highlightedCount ?? 'x';
      const goodReviewsCount = stat.goodReviewsCount ?? 'x';
      const allReviewsLength = stat.allReviewsLength ?? 'x';

      const target = row.querySelector(".moly-space-item.moly-space-item-first");
      console.log('target:', target);
      
      if (target) {
  // Проверяем, есть ли уже statsDiv после target
  let statsDiv = target.nextElementSibling;
  if (!statsDiv || !statsDiv.classList.contains("review-stats")) {
    statsDiv = document.createElement("div");
    statsDiv.className = "review-stats";
    statsDiv.style.marginTop = "8px";
    statsDiv.style.fontSize = "12px";
    statsDiv.style.color = "#444";
    target.insertAdjacentElement("afterend", statsDiv);
  }

  // Определяем цвет для highlightedCount
  const highlightedColor = highlightedCount === 0 ? "#27F54D" : "#DC143C";

  // Обновляем содержимое
  statsDiv.innerHTML = `
    <div style="display:grid; gap:8px; margin-top:4px;">
      <span>+<strong>${goodReviewsCount}</strong></span>
      <span>-<strong>${allReviewsLength}</strong></span>
      <span><strong style="color:${highlightedColor}">${highlightedCount}</strong></span>
    </div>
  `;
}


      // пометим строку, чтобы можно было CSS-стилями выделить её
      row.classList.add('has-review-stats');
    }

    newTd.innerHTML = inner;

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
            // Альтернативный вариант - если нужно вставить в определенное место внутри модала
            const reviewsInterval = setInterval(() => {                  
            const modal = document.querySelector('[role="dialog"], [aria-modal="true"]');                  
            console.log('modal:', modal);                       
            
            if (modal) {
                // Заменяем стиль width на w-full
                modal.style.width = '';  // Убираем inline width
                modal.classList.remove(...Array.from(modal.classList).filter(cls => cls.includes('width') || cls.includes('w-')));
                modal.classList.add('w-full');
                
                let reviewsContainer = document.getElementById("reviews-container");                        
                
                if (!reviewsContainer) {                          
                    reviewsContainer = document.createElement("div");                          
                    reviewsContainer.className = "terms-content";                          
                    reviewsContainer.id = "reviews-container";                          
                    reviewsContainer.style.marginTop = "20px";                          
                    reviewsContainer.innerHTML = '<div class="spinner">Загружаем отзывы...</div>';                            
                    
                    // Ищем конкретный элемент внутри модала (например, форму или кнопки)                   
                    const insertTarget = modal.querySelector('form, .modal-footer, .button-group') ||                                        
                                        modal.querySelector('.modal-content, .modal-body, [class*="content"]') ||                                        
                                        modal;                                      
                    
                    // Вставляем перед найденным элементом или в конец                   
                    if (insertTarget && insertTarget !== modal) {                     
                        insertTarget.parentNode.insertBefore(reviewsContainer, insertTarget);                   
                    } else {                     
                        modal.appendChild(reviewsContainer);                   
                    }                 
                }                        
                
                loadAndDisplayReviews(ads[index]);                 
                clearInterval(reviewsInterval);                  
                console.log('отзывы вставлены, стиль обновлен');                                  
            } else {                      
                console.warn("Модальное окно не найдено");                  
            }              
        }, 100);


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
