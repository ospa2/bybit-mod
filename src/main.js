import "./style.css";
import { initSliderReplacement } from "C:/Web/bybitmod/bybit-mod/src/components/rangeSlider.js";
import { updateGlobalValues } from "./state.js";
import {
  loadOnceAndApply,
  observeUrlChanges,
} from "./logic/loader.js";
import { filterRemark } from "./utils/formatters.js";
import { adShouldBeFiltered } from "./logic/adFilter.js";
import { loadAndDisplayReviews } from "./components/review.js";
import { GM_xmlhttpRequest, GM_getValue } from "$";
import { bestMerchants } from "./config.js";
let periodicRefreshId = null;

function now() {
  return new Date().toISOString();
}

function startPeriodicRefresh() {
  stopPeriodicRefresh();
  // Только на buy странице обновляем раз в 3000ms
  if (location.href.includes("/buy/USDT/RUB")) {
    periodicRefreshId = setInterval(() => {
      // Запускаем загрузку (внутри уже есть защита от параллельных вызовов)
      loadOnceAndApply().catch((e) => console.error("periodic load error:", e));
    }, 3000);
    console.log(`[${now()}] Periodic refresh запущен.`);
  }
}

function stopPeriodicRefresh() {
  if (periodicRefreshId) {
    clearInterval(periodicRefreshId);
    periodicRefreshId = null;
    console.log(`[${now()}] Periodic refresh остановлен.`);
  }
}

function waitForTableAndStart() {
  const tbody = document.querySelector(".trade-table__tbody");

  if (!tbody || tbody.children.length === 0) {
    console.log("Ожидание таблицы...");
    setTimeout(waitForTableAndStart, 500);
    return;
  }

  // Очистим старые динамические строки
  tbody.querySelectorAll(".dynamic-row").forEach((row) => row.remove());
  tbody.querySelector(".completion-indicator")?.remove();

  // Запускаем наблюдение за URL и начальную инициализацию
  observeUrlChanges();

  // Инициализация слайдера
  setTimeout(() => {
    initSliderReplacement({
      min: 9000,
      max: 80000,
      onUpdate: updateGlobalValues,
    });

    // Первичная загрузка
    loadOnceAndApply();

    // Запустить периодический рефреш если мы на buy
    startPeriodicRefresh();

    // Если URL сменится — observeUrlChanges вызовет handleUrlChange, и можно остановить/запустить периодический рефреш там же.
    // Потому добавим слушатель попstate для управления периодическим рефрешем:
    window.addEventListener("popstate", () => {
      if (location.href.includes("/buy/USDT/RUB")) startPeriodicRefresh();
      else stopPeriodicRefresh();
    });

    // И ещё перехваты history API — для случая pushState/replaceState
    const originalPush = history.pushState;
    history.pushState = function (...args) {
      originalPush.apply(this, args);
      if (location.href.includes("/buy/USDT/RUB")) startPeriodicRefresh();
      else stopPeriodicRefresh();
    };
    const originalReplace = history.replaceState;
    history.replaceState = function (...args) {
      originalReplace.apply(this, args);
      if (location.href.includes("/buy/USDT/RUB")) startPeriodicRefresh();
      else stopPeriodicRefresh();
    };

    // Отметить текущие строки как filtered-ads (если нужно)
    document
      .querySelectorAll(".trade-table__tbody tr")
      .forEach((row) => row.classList.add("filtered-ads"));
  }, 100);
}

setTimeout(waitForTableAndStart, 100);

const originalFetch = window.fetch;

// Объявляем обработчик глобально, чтобы можно было его удалить
// Объявляем обработчик глобально, чтобы можно было его удалить
let currentButtonClickHandler = null;
let modal = null;
window.fetch = async (...args) => {
  // args[0] — URL, args[1] — опции (method, body и т.д.)
  let shouldIntercept = false;
  let shouldInterceptSell = false;

  if (args[0].includes("/x-api/fiat/otc/item/online") && args[1]?.body) {
    try {
      const body = JSON.parse(args[1].body);
      if (body.side === "0") {//sell
        shouldIntercept = true;
      }
    } catch (e) {
      console.warn("Не удалось распарсить body:", args[1].body);
    }
  } else if (args[0].includes("x-api/fiat/otc/order/create") && args[1]?.body) {
    try {
      const body = JSON.parse(args[1].body);
      if (body.side === "1") {
        //sell
        shouldInterceptSell = true;
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
          storedStats = GM_getValue("reviewsStatistics_v1", []);
          if (!Array.isArray(storedStats)) storedStats = [];
        } catch (err) {
          console.warn(
            "Не удалось прочитать reviewsStatistics_v1 из GM-хранилища:",
            err
          );
          storedStats = [];
        }

        document
          .querySelectorAll(".trade-table__tbody tr")
          .forEach((row, i) => {
            const ad = ads[i];
            if (!ad) return; // защититься от рассинхрона длины списков

            if (adShouldBeFiltered(ad)) {
              row.classList.add("filtered-ad");
              return;
            }
            
            if (bestMerchants.includes(ad.userId)) {
              const sellBtn = row.querySelector(
                ".trade-list-action-button button"
              );
              if (sellBtn) {
                sellBtn.click();
              }
            }
            // Создаем новый td элемент
            const newTd = document.createElement("td");
            newTd.style.width = "100px";
            newTd.style.padding = "12px";

            // Получаем статистику для текущего userId (строка/число — сравниваем как строки)
            const stat = storedStats.find(
              (s) => String(s.userId) === String(ad.userId)
            );

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
              const highlightedCount = stat.highlightedCount ?? "x";
              const goodReviewsCount = stat.goodReviewsCount ?? "x";
              const allReviewsLength = stat.allReviewsLength ?? "x";

              const target = row.querySelector(
                ".moly-space-item.moly-space-item-first"
              );

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
                const highlightedColor =
                  highlightedCount === 0 ? "#27F54D" : "#DC143C";

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
              row.classList.add("has-review-stats");
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
              modal = document.querySelector(
                '[role="dialog"], [aria-modal="true"]'
              );

              if (modal) {
                // Заменяем стиль width на w-full
                modal.style.width = ""; // Убираем inline width
                modal.classList.remove(
                  ...Array.from(modal.classList).filter(
                    (cls) => cls.includes("width") || cls.includes("w-")
                  )
                );
                modal.classList.add("w-full");

                let reviewsContainer =
                  document.getElementById("reviews-container");

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
                  if (insertTarget && insertTarget !== modal) {
                    insertTarget.parentNode.insertBefore(
                      reviewsContainer,
                      insertTarget
                    );
                  } else {
                    modal.appendChild(reviewsContainer);
                  }
                }

                loadAndDisplayReviews(ads[index]);
                clearInterval(reviewsInterval);
                console.log("отзывы вставлены, стиль обновлен");
              }
            }, 100);
          }
        };

        // Добавляем новый обработчик
        document.addEventListener("click", currentButtonClickHandler);
      })
    } else if(shouldInterceptSell){
    response
      .clone()
      .json()
      .then(() => {
        const body = JSON.parse(args[1].body)
        console.log('modal:', modal);//null почему то
        
        const span = modal.querySelector(".advertiser-name");
        const nickName = span.firstChild.textContent
        console.log('nickName:', nickName);
        

        const newOrder = {
          "Order No.": body.itemId, // уникальный номер
          Type: "SELL", // "BUY" или "SELL"
          "Fiat Amount": body.amount, // фиат сумма
          Price: (parseFloat(body.amount) / parseFloat(body.quantity)).toFixed(2), // цена за монету
          "Coin Amount": body.quantity, // количество монет
          Counterparty: nickName || "Unknown", // контрагент
          Status: "Completed", // или "Canceled"
          Time: new Date().toISOString(), // ISO формат даты
        };

        GM_xmlhttpRequest({
          method: "POST",
          url: "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          data: JSON.stringify(newOrder),
          onload: function (response) {
            console.log("Запрос успешно отправлен!");
            console.log("Статус ответа:", response.status);
            console.log("Тело ответа:", response.responseText);
            // Если сервер возвращает JSON, вы можете его распарсить:
            // const responseData = JSON.parse(response.responseText);
          },
          onerror: function (response) {
            console.error("Произошла ошибка при отправке запроса.");
            console.error("Статус ответа:", response.status);
            console.error("Текст ошибки:", response.statusText);
          },
        });
    
  
      })
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

// Вставьте этот код в консоль браузера для использования на любом сайте
class AutoClickElements {
  constructor() {
    this.observer = null;
    this.isActive = false;
    this.start();
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForElements(node);
            }
          });
        }
      });
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.checkForElements(document.body);
    console.log("AutoClick: Мониторинг всех элементов запущен");
  }

  checkForElements(element) {
    if (!this.isActive) return;

    // 1. Ищем кнопки с текстом "Подтвердить с помощью ключа доступа"
    const buttons = element.querySelectorAll
      ? element.querySelectorAll("button")
      : element.tagName === "BUTTON"
      ? [element]
      : [];

    buttons.forEach((button) => {
      const buttonText = button.textContent?.trim();
      if (
        buttonText &&
        buttonText.includes("Подтвердить с помощью ключа доступа")
      ) {
        console.log("AutoClick: Найдена кнопка подтверждения, выполняю клик");
        this.clickElement(button, "button");
      }
    });

    // 2. Ищем span с текстом "Все"
    const allSpans = element.querySelectorAll
      ? element.querySelectorAll("span")
      : element.tagName === "SPAN"
      ? [element]
      : [];

    allSpans.forEach((span) => {
      const spanText = span.textContent?.trim();
      if (spanText === "Все" && span.classList.contains("amount-input-all")) {
        console.log('AutoClick: Найден span "Все", выполняю клик');
        this.clickElement(span, "span");
      }
    });

    // 3. Ищем селект "Выбрать способ оплаты"
    const paymentSelects = element.querySelectorAll
      ? element.querySelectorAll("div")
      : element.tagName === "DIV"
      ? [element]
      : [];

    paymentSelects.forEach((div) => {
      const selectText = div.textContent?.trim();
      if (
        selectText &&
        selectText.includes("Выбрать способ оплаты") &&
        div.classList.contains("cursor-pointer")
      ) {
        console.log("AutoClick: Найден селект способа оплаты, открываю список");
        this.clickElement(div, "payment selector", () => {
          // После клика ждем и ищем SBP
          setTimeout(() => {
            this.findAndClickSBP();
            // const sellButton = modal.querySelector("button.moly-btn");
            // if (sellButton && sellButton.textContent.includes("Продажа")) {
            //   sellButton.click();
            //   console.log('sellButton:', sellButton);
              
            // }
          }, 2500);
        });
      }
    });
  }

  findAndClickSBP() {
    const sbpDivs = document.querySelectorAll(
      "div.payment-select__list-wrapper"
    );

    sbpDivs.forEach((div) => {
      const sbpSpan = div.querySelector("span");
      if (
        sbpSpan &&
        (sbpSpan.textContent?.trim() === "SBP" ||
          sbpSpan.textContent?.trim() === "Sberbank" ||
          sbpSpan.textContent?.trim() === "Tinkoff" ||
          sbpSpan.textContent?.trim() === "OZON Bank" ||
          sbpSpan.textContent?.trim() === "Local Card(Yellow)")
      ) {
        console.log("AutoClick: Найден SBP, выполняю клик");
        this.clickElement(div, "SBP div");
      }
    });

    // Повторная попытка если не нашли
    if (sbpDivs.length === 0) {
      console.log("AutoClick: SBP еще не загрузился, повторная попытка...");
      setTimeout(() => {
        this.findAndClickSBP();
      }, 1000);
    }
  }

  clickElement(element, type, callback) {
    try {
      if (element.disabled) {
        console.log(`AutoClick: ${type} отключен`);
        return;
      }

      if (type == "span") {
        let i = 0;
        let interval = setInterval(() => {
          if (i > 10) {
            clearInterval(interval);
          }
          i++;
          element.focus();
          element.click();
          console.log(`span`);
        }, 300);
      } else {
        element.focus();
        element.click();
        console.log(`button`);
      }

      if (callback && typeof callback === "function") {
        callback();
      }
    } catch (error) {
      console.log(`AutoClick: Ошибка при клике на ${type}:`, error.message);
    }
  }
}

// Запуск
window.autoClickElements = new AutoClickElements();



 const API_KEY = "K8CPRLuqD302ftIfua";
 const API_SECRET = "E86RybeO4tLjoXiR5YYtbVStHC9qXCHDBeOI";

 // Подключение к приватному WebSocket
 const ws = new WebSocket("wss://stream.bybit.com/v5/private");

async function getAuthParams() {
  const expires = Date.now() + 60_000;
  const encoder = new TextEncoder();

  // Импортируем секретный ключ
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Подписываем строку (apiKey + expires)
  const signatureBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(API_KEY + expires)
  );

  // Преобразуем ArrayBuffer → hex строку
  const signature = Array.from(new Uint8Array(signatureBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { api_key: API_KEY, expires, signature };
}


let pingInterval;

ws.onopen = async () => {
  console.log("✅ WS connected");

  const { api_key, expires, signature } = await getAuthParams();

  ws.send(
    JSON.stringify({
      op: "auth",
      args: [api_key, expires, signature],
    })
  );

  // Запускаем пинг каждые 20 секунд
  pingInterval = setInterval(() => {
    ws.send(JSON.stringify({ op: "ping", ts: Date.now() }));
  }, 20_000);
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log("📩 MSG:", msg);

  if (msg.op === "auth" && msg.success) {
    console.log("✅ Auth success, подписываемся на ордера...");
    ws.send(JSON.stringify({ op: "subscribe", args: ["order"] }));
  }

  // Отвечаем на ping сервера
  if (msg.op === "ping") {
    ws.send(JSON.stringify({ op: "pong", ts: msg.ts }));
  }

  if (msg.topic === "order" && msg.data) {
    msg.data.forEach((order) => {
      console.log(`➡️ Ордер ${order.orderId} → статус: ${order.orderStatus}`);
    });
  }
};

ws.onclose = () => {
  console.warn("⚠️ WS disconnected");
  clearInterval(pingInterval);
};

ws.onerror = (err) => {
  console.error("❌ WS error", err);
};
