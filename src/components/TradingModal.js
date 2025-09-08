import { disableBodyScroll, enableBodyScroll } from "../utils/domHelpers.js";
import { loadAndDisplayReviews } from "./review.js";
import { startPriceTimer } from "../utils/timers.js";
import { showNotification } from "../utils/notifications.js";
import { paymentNames } from "../config.js";
import { GM_xmlhttpRequest } from "$";
export async function openTradingModal(originalAd) {
  // 1. --- ФАЗА НЕМЕДЛЕННОГО ОТОБРАЖЕНИЯ ---

  // Удаляем предыдущее модальное окно, если оно есть
  disableBodyScroll();
  const existingModal = document.querySelector(".bybit-modal-overlay");
  if (existingModal) {
    existingModal.remove();
  }

  // Создаем оверлей и модальное окно СРАЗУ
  const overlay = document.createElement("div");
  overlay.className = "bybit-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "bybit-modal";

  // Вставляем "скелет" модального окна с данными из originalAd и плейсхолдерами для загрузки
  modal.innerHTML = `
        <div class="bybit-modal-header">
            <button class="bybit-modal-close" type="button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.854 3.146a.5.5 0 0 1 0 .708l-9 9a.5.5 0 0 1-.708-.708l9-9a.5.5 0 0 1 .708 0z"/><path d="M3.146 3.146a.5.5 0 0 1 .708 0l9 9a.5.5 0 0 1-.708.708l-9-9a.5.5 0 0 1 0-.708z"/></svg>
            </button>
        </div>
        <div class="bybit-modal-body">
            <div class="advertiser-panel">
                <div> 
                    <div class="advertiser-header">
                        <div class="avatar-container">
                            <div class="avatar ${
                              originalAd.isOnline ? "online" : ""
                            }">${(originalAd.nickName || "U")
    .charAt(0)
    .toUpperCase()}</div>
                        </div>
                        <div class="advertiser-info">
                            <div class="advertiser-name">${
                              originalAd.nickName || "Unknown"
                            }</div>
                            <div class="advertiser-stats">
                                <span>${
                                  originalAd.finishNum || 0
                                } исполнено</span><span class="stats-divider">|</span><span>${
    originalAd.recentExecuteRate || 0
  }%</span>
                            </div>
                            <div class="online-status">${
                              originalAd.isOnline ? "Онлайн" : "Офлайн"
                            }</div>
                        </div>
                    </div>
                    <div class="verification-tags">
                        <div class="verification-tag">Эл. почта</div><div class="verification-tag">SMS</div><div class="verification-tag">Верификация личности</div>
                    </div>
                    <div class="crypto-info-section">
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Доступно</span>
                            <span class="crypto-info-value" id="balance-value"><div class="spinner small"></div></span>
                        </div>
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Лимиты</span>
                            <span class="crypto-info-value">${parseFloat(
                              originalAd.minAmount || 0
                            ).toLocaleString("ru-RU")} ~ ${parseFloat(
    originalAd.maxAmount || 0
  ).toLocaleString("ru-RU")} ${originalAd.currencyId || "RUB"}</span>
                        </div>
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Длительность оплаты</span>
                            <span class="crypto-info-value">${
                              originalAd.paymentPeriod || 15
                            } мин.</span>
                        </div>
                    </div>
                </div>
                <div class="terms-section">
                    <div class="terms-title" id="reviews-titleee">Хороших отзывов: ...</div>
                    <div class="terms-content" id="reviews-container"><div class="spinner"></div></div>
                </div>
            </div>
            <div class="trading-panel">
                <div class="price-section">
                    <div class="price-header">
                        <span class="price-label">Цена</span>
                        <span class="price-timer" id="price-timer">30s</span>
                    </div>
                    <div class="price-value">${parseFloat(
                      originalAd.price
                    ).toFixed(2)} ${originalAd.currencyId || "RUB"}</div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я ${
                      originalAd.side === 1 ? "куплю" : "продам"
                    }</label>
                    <div class="input-container" id="amount-container">
                        <div class="input-wrapper">
                            <input type="text" class="amount-input" id="amount-input" placeholder="0.0000" autocomplete="off">
                            <div class="input-suffix">
                                <span>${
                                  originalAd.tokenId || "USDT"
                                }</span><span class="input-divider">|</span><button type="button" class="max-button" id="max-button">Все</button>
                            </div>
                        </div>
                    </div>
                    <div class="balance-info" id="available-for-trade">Доступно для ${
                      originalAd.side === 1 ? "покупки" : "продажи"
                    }: <span class="spinner small"></span></div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я получу</label>
                    <div class="input-container"><div class="input-wrapper">
                        <div style="width: 24px;">₽</div>
                        <input type="text" class="amount-input" id="receive-input" placeholder="0.00">
                        <div class="input-suffix"><span>${
                          originalAd.currencyId || "RUB"
                        }</span></div>
                    </div></div>
                </div>
                <div class="payment-section">
                    <label class="input-label">Способ оплаты</label>
                    <div class="payment-methods">
                        ${
                          originalAd.payments && originalAd.payments.length > 0
                            ? originalAd.payments
                                .map(
                                  (paymentId) =>
                                    `<span class="payment-method">${
                                      paymentNames[paymentId] || paymentId
                                    }</span>`
                                )
                                .join("")
                            : '<span class="payment-method">Не указано</span>'
                        }
                    </div>
                </div>
                <div class="button-section">
                    <button type="button" class="trade-button" id="trade-button" disabled>${
                      originalAd.side === 1 ? "Купить" : "Продать"
                    } ${originalAd.tokenId || "USDT"}</button>
                    <button type="button" class="cancel-button" id="cancel-button">Отмена</button>
                </div>
            </div>
        </div>
    `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  // Запускаем асинхронную загрузку отзывов
  loadAndDisplayReviews(originalAd);
  startPriceTimer();
  // 2. --- ФАЗА ФОНОВОЙ ЗАГРУЗКИ И ОБНОВЛЕНИЯ ---
  try {
    const payload = { item_id: originalAd.id, shareCode: null };
    const res = await fetch(
      "https://www.bybit.com/x-api/fiat/otc/item/simple",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      throw new Error(`Ошибка сети: ${res.statusText}`);
    }

    const apiRes = await res.json();

    if (apiRes.ret_code !== 0) {
      // Если API вернуло ошибку, показываем ее и закрываем окно
      showNotification(
        apiResult.ret_msg || "Не удалось загрузить детали объявления.",
        "error"
      );
      closeModal();
      return;
    }

    const apiResult = apiRes.result;
    apiResult.side = originalAd.side;
    apiResult.nickName = originalAd.nickName;

    // ВАЖНО: Только теперь, когда все данные загружены, мы "оживляем" модальное окно
    setupModalEvents(apiResult);
  } catch (e) {
    console.error("Ошибка при подгрузке деталей объявления:", e);
    showNotification(
      "Ошибка при подгрузке деталей. Попробуйте снова.",
      "error"
    );
    // Закрываем модальное окно при ошибке, чтобы пользователь не застрял
    closeModal();
  }
}
function closeModal() {
  const overlay = document.querySelector(".bybit-modal-overlay");
  if (overlay) {
    overlay.remove();
  }
  document.body.style.overflow = "";
  enableBodyScroll();
}

export function setupModalEvents(apiResult) {
  const overlay = document.querySelector(".bybit-modal-overlay");
  const amountInput = overlay.querySelector("#amount-input");
  const receiveInput = overlay.querySelector("#receive-input");
  const tradeButton = overlay.querySelector("#trade-button");
  const cancelButton = overlay.querySelector("#cancel-button");
  const maxButton = overlay.querySelector("#max-button");
  const closeButton = overlay.querySelector(".bybit-modal-close");

  // Выносим цену в общую область видимости для удобства
  const price = parseFloat(apiResult.price) || 0;

  function validateAndToggleButton() {
    const amount = parseFloat(amountInput.value) || 0;
    const minAmount = parseFloat(apiResult.minAmount) || 0;
    const maxAmount = parseFloat(apiResult.maxAmount) || 0;
    const availableBalance = overlay.querySelector(".balance-info");
    const textContent = availableBalance.textContent;

    const cleanedString = textContent
      .replace("Доступно для ", "")
      .replace("покупки:", "")
      .replace("продажи:", "")
      .replace("USDT", "")
      .replace(/\s+/g, "")
      .replace(",", ".")
      .trim();
    const balance = parseFloat(cleanedString);

    const minAmountInUSDT = price > 0 ? (minAmount / price).toFixed(4) : 0;
    const maxAmountInUSDT = price > 0 ? (maxAmount / price).toFixed(4) : 0;

    const isValid =
      (amount > 0 &&
        amount >= minAmountInUSDT &&
        amount <= maxAmountInUSDT &&
        amount <= balance) ||
      window.location.href.includes("buy");

    console.log(
      amount,
      "> 0 &&",
      amount,
      ">=",
      minAmountInUSDT,
      "&&",
      amount,
      "<=",
      maxAmountInUSDT,
      "&&",
      amount,
      "<=",
      balance
    );

    tradeButton.disabled = !isValid;
    tradeButton.style.opacity = isValid ? "1" : "0.6";
    tradeButton.style.cursor = isValid ? "pointer" : "not-allowed";
  }

  // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

  function handleAmountChange() {
    const amount = parseFloat(amountInput.value) || 0;
    const receiveAmount = amount * price;
    receiveInput.value = receiveAmount.toFixed(2);
    validateAndToggleButton();
  }

  function handleReceiveChange() {
    const receiveValue = parseFloat(receiveInput.value) || 0;
    const amountValue = price > 0 ? receiveValue / price : 0;
    amountInput.value = amountValue.toFixed(4);
    validateAndToggleButton();
  }

  // --- НОВАЯ ФУНКЦИЯ ФОРМАТИРОВАНИЯ ---
  // Срабатывает, когда пользователь убирает фокус с поля RUB
  function formatReceiveInputOnBlur() {
    const currentValue = parseFloat(receiveInput.value) || 0;
    receiveInput.value = currentValue.toFixed(2);
  }

  // --- УСТАНОВКА СЛУШАТЕЛЕЙ ---
  amountInput.addEventListener("input", handleAmountChange);
  receiveInput.addEventListener("input", handleReceiveChange);

  // Добавляем новый слушатель события 'blur'
  receiveInput.addEventListener("blur", formatReceiveInputOnBlur);

  // === Покупка у продавца ===
  function createBuyPayload(apiResult) {
    return {
      itemId: apiResult.id,
      tokenId: "USDT", //originalAd.tokenId
      currencyId: "RUB", //originalAd.currencyId
      side: "0",
      quantity: parseFloat(amountInput.value).toString(), // $$
      amount: (parseFloat(amountInput.value) * apiResult.price)
        .toFixed(2)
        .toString(), //₽₽₽
      curPrice: apiResult.curPrice,
      flag: "amount",
      version: "1.0",
      securityRiskToken: "",
      isFromAi: false,
    };
  }
  async function saveOrder() {
    // Загружаем текущие ордера
    let orders = JSON.parse(localStorage.getItem("orders") || "[]");

    // Создаём новый объект ордера
   const newOrder = {
     "Order No.": apiResult.id, // уникальный номер
     Type: "BUY", // "BUY" или "SELL"
     "Fiat Amount": (parseFloat(amountInput.value) * apiResult.price)
       .toFixed(2)
       .toString(), // фиат сумма
     Price: apiResult.price, // цена за монету
     "Coin Amount": parseFloat(amountInput.value).toString(), // количество монет
     Counterparty: apiResult.nickName, // контрагент
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
    // Добавляем в массив
    orders.push(newOrder);

    // Сохраняем обратно
    localStorage.setItem("orders", JSON.stringify(orders));
  }

  // Обработка ввода суммы
  amountInput.addEventListener("input", validateAndToggleButton);
  amountInput.addEventListener("keyup", validateAndToggleButton);

  // Кнопка "Все"
  maxButton.addEventListener("click", () => {
    const maxAmount = Math.min(
      parseFloat(apiResult.maxAmount / apiResult.price) || 0
    );
    amountInput.value = maxAmount.toFixed(4);
    console.log("apiResult: ", apiResult);

    validateAndToggleButton();
  });

  // НОВАЯ ЛОГИКА: Обработчик для кнопки торговли
  tradeButton.addEventListener("click", async () => {
    // Отключаем кнопку и показываем состояние загрузки
    tradeButton.disabled = true;
    const originalText = tradeButton.textContent;
    tradeButton.textContent = "Отправка заявки...";
    tradeButton.style.opacity = "0.6";

    try {
      if (apiResult.ret_code == 912100027) {
        showNotification(
          "The ad status of your P2P order has been changed. Please try another ad.",
          "error"
        );
        closeModal();
        throw new Error(
          "The ad status of your P2P order has been changed. Please try another ad."
        );
      }
      if (apiResult.ret_code == 912300001) {
        showNotification(
          "Insufficient ad inventory, please try other ads.",
          "error"
        );
        closeModal();
        throw new Error("Insufficient ad inventory, please try other ads.");
      }
      // Формируем payload для создания ордера
      const orderPayload = createBuyPayload(apiResult);

      console.log("Отправка ордера:", orderPayload);

      // Отправляем POST запрос на создание ордера
      const response = await fetch(
        "https://www.bybit.com/x-api/fiat/otc/order/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include", // Добавлено для куки авторизации
          body: JSON.stringify(orderPayload),
        }
      );

      const result = await response.json();

      if (response.ok && result.ret_code === 0) {
        // Ордер создан успешно без верификации
        saveOrder();
        console.log("✅ Ордер на покупку создан успешно:", result);
        showNotification("ордер успешно создан", "success");
        closeModal();
        return result;
      } else {
        // Обработка других ошибок
        showNotification(result.ret_msg || result, "error");
        closeModal();
        throw new Error(
          `Order creation failed: ${result.ret_msg || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Ошибка при создании ордера:", error);
      throw error;
    } finally {
      // Восстанавливаем состояние кнопки
      tradeButton.disabled = false;
      tradeButton.textContent = originalText;
      tradeButton.style.opacity = "1";
      setTimeout(() => {
        validateAndToggleButton();
      }, 2000); // Повторно валидируем
    }
  });

  // Закрытие модального окна

  cancelButton.addEventListener("click", () => closeModal());
  closeButton.addEventListener("click", () => closeModal());

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  });

  const intervalId = setInterval(() => {
    const tradeButton = overlay.querySelector("#trade-button");

    // Клик по кнопке "max"
    if (maxButton) {
      maxButton.click();
    }

    // Вызов функции валидации
    validateAndToggleButton();
    handleAmountChange();

    // Проверка состояния кнопки "trade"
    if (tradeButton && !tradeButton.disabled) {
      // Если кнопка не заблокирована, останавливаем интервал
      clearInterval(intervalId);
    }
  }, 50);
}
