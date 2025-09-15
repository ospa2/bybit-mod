import { disableBodyScroll, enableBodyScroll } from "../utils/domHelpers.ts";
import { loadAndDisplayReviews } from "./review.ts";
import { startPriceTimer } from "../utils/priceTimer.ts";
import { showNotification } from "../utils/notifications.ts";
import { paymentNames } from "../config.ts";
import { GM_xmlhttpRequest } from "$";
import type { Ad, ApiResult } from "../types/ads";


interface OrderPayload {
  itemId: string;
  tokenId: string;
  currencyId: string;
  side: string;
  quantity: string;
  amount: string;
  curPrice: string | number;
  flag: string;
  version: string;
  securityRiskToken: string;
  isFromAi: boolean;
}

interface Order {
  "Order No.": string;
  Type: string;
  "Fiat Amount": string;
  Price: string | number;
  "Coin Amount": string;
  Counterparty: string;
  Status: string;
  Time: string;
}

interface ApiResponse {
  ret_code: number;
  ret_msg?: string;
}
export async function openTradingModal(originalAd: Ad, autoarbitrage: boolean) {
  // 1. --- ФАЗА НЕМЕДЛЕННОГО ОТОБРАЖЕНИЯ ---
  if (!autoarbitrage) {
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
                              originalAd.minAmount || "0"
                            ).toLocaleString("ru-RU")} ~ ${parseFloat(
      originalAd.maxAmount || "0"
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
                                      paymentNames[
                                        paymentId as keyof typeof paymentNames
                                      ] || paymentId
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
  }
  // Удаляем предыдущее модальное окно, если оно есть
  
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
        apiRes.ret_msg || "Не удалось загрузить детали объявления.",
        "error"
      );
      closeModal();
      return;
    }

    const apiResult = apiRes.result;
    apiResult.side = originalAd.side;
    apiResult.nickName = originalAd.nickName;

    // ВАЖНО: Только теперь, когда все данные загружены, мы "оживляем" модальное окно
    setupModalEvents(apiResult, autoarbitrage);
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



export function setupModalEvents(
  apiResult: ApiResult,
  autoarbitrage: boolean
): void {
  const overlay = document.querySelector(
    ".bybit-modal-overlay"
  ) as HTMLElement | null;
  if (!overlay && !autoarbitrage) {
    console.error("Modal overlay not found");
    return;
  }

  const amountInput = overlay?.querySelector(
    "#amount-input"
  ) as HTMLInputElement | null;
  const receiveInput = overlay?.querySelector(
    "#receive-input"
  ) as HTMLInputElement | null;
  const tradeButton = overlay?.querySelector(
    "#trade-button"
  ) as HTMLButtonElement | null;
  const cancelButton = overlay?.querySelector(
    "#cancel-button"
  ) as HTMLButtonElement | null;
  const maxButton = overlay?.querySelector(
    "#max-button"
  ) as HTMLButtonElement | null;
  const closeButton = overlay?.querySelector(
    ".bybit-modal-close"
  ) as HTMLButtonElement | null;

  if (
    (!amountInput ||
      !receiveInput ||
      !tradeButton ||
      !cancelButton ||
      !maxButton ||
      !closeButton) &&
    !autoarbitrage
  ) {
    console.error("Required modal elements not found");
    return;
  }

  const price: number = parseFloat(String(apiResult.price)) || 0;

  function validateAndToggleButton(): boolean {
    const amount: number = amountInput ? parseFloat(amountInput.value) : 0;
    const minAmount: number = parseFloat(String(apiResult.minAmount)) || 0;
    const maxAmount: number = parseFloat(String(apiResult.maxAmount)) || 0;
    const availableBalance = overlay
      ? (overlay.querySelector(".balance-info") as HTMLElement | null)
      : null;

    if (!availableBalance?.textContent) {
      console.warn("Balance info not found");
      return false;
    }

    const balance: number = parseFloat(
      availableBalance.textContent
        .replace("Доступно для ", "")
        .replace("покупки:", "")
        .replace("продажи:", "")
        .replace("USDT", "")
        .replace(/\s+/g, "")
        .replace(",", ".")
        .trim()
    );

    const minAmountInUSDT: number =
      price > 0 ? parseFloat((minAmount / price).toFixed(4)) : 0;
    const maxAmountInUSDT: number =
      price > 0 ? parseFloat((maxAmount / price).toFixed(4)) : 0;

    const isValid: boolean =
      (amount > 0 &&
        amount >= minAmountInUSDT &&
        amount <= maxAmountInUSDT &&
        amount <= balance) ||
      window.location.href.includes("buy");

    if (tradeButton) {
      tradeButton.disabled = !isValid;
      tradeButton.style.opacity = isValid ? "1" : "0.6";
      tradeButton.style.cursor = isValid ? "pointer" : "not-allowed";
    }

    return isValid;
  }

  function handleAmountChange(): void {
    if (!amountInput || !receiveInput) return;
    const amount: number = parseFloat(amountInput.value) || 0;
    const receiveAmount: number = amount * price;
    receiveInput.value = receiveAmount.toFixed(2);
    validateAndToggleButton();
  }

  function createBuyPayload(apiResult: ApiResult): OrderPayload {
    return {
      itemId: apiResult.id,
      tokenId: "USDT",
      currencyId: "RUB",
      side: "0",
      quantity: amountInput ? parseFloat(amountInput.value).toString() : "0.00",
      amount: amountInput
        ? (parseFloat(amountInput.value) * parseFloat(String(apiResult.price)))
            .toFixed(2)
            .toString()
        : "0.00",
      curPrice: apiResult.curPrice,
      flag: "amount",
      version: "1.0",
      securityRiskToken: "",
      isFromAi: false,
    };
  }

  async function saveOrder(): Promise<void> {
    let orders: Order[] = JSON.parse(localStorage.getItem("orders") || "[]");

    const newOrder: Order = {
      "Order No.": apiResult.id,
      Type: "BUY",
      "Fiat Amount": amountInput
        ? (parseFloat(amountInput.value) * parseFloat(String(apiResult.price)))
            .toFixed(2)
            .toString()
        : "0",
      Price: apiResult.price,
      "Coin Amount": amountInput
        ? parseFloat(amountInput.value).toString()
        : "0",
      Counterparty: apiResult.nickName,
      Status: "Completed",
      Time: new Date().toISOString(),
    };

    GM_xmlhttpRequest({
      method: "POST",
      url: "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      data: JSON.stringify(newOrder),
      onload: (response: any): void => {
        console.log(
          "Запрос успешно отправлен!",
          response.status,
          response.responseText
        );
      },
      onerror: (response: any): void => {
        console.error(
          "Ошибка при отправке запроса:",
          response.status,
          response.statusText
        );
      },
    });

    orders.push(newOrder);
    localStorage.setItem("orders", JSON.stringify(orders));
  }

  async function executeTrade(): Promise<void> {
    if (!tradeButton) return;
    tradeButton.disabled = true;
    const originalText: string = tradeButton.textContent || "";
    tradeButton.textContent = "Отправка заявки...";
    tradeButton.style.opacity = "0.6";

    try {
      if (apiResult.ret_code === 912100027) {
        showNotification(
          "The ad status of your P2P order has been changed. Please try another ad.",
          "error"
        );
        closeModal();
        throw new Error("Ad status changed");
      }
      if (apiResult.ret_code === 912300001) {
        showNotification(
          "Insufficient ad inventory, please try other ads.",
          "error"
        );
        closeModal();
        throw new Error("No inventory");
      }

      const orderPayload: OrderPayload = createBuyPayload(apiResult);
      console.log("Отправка ордера:", orderPayload);

      const response: Response = await fetch(
        "https://www.bybit.com/x-api/fiat/otc/order/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify(orderPayload),
        }
      );

      const result: ApiResponse = await response.json();

      if (response.ok && result.ret_code === 0) {
        await saveOrder();
        showNotification("ордер успешно создан", "success");
        closeModal();
      } else {
        showNotification(result.ret_msg || String(result), "error");
        closeModal();
        throw new Error(
          `Order creation failed: ${result.ret_msg || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Ошибка при создании ордера:", error);
    } finally {
      tradeButton.disabled = false;
      tradeButton.textContent = originalText;
      tradeButton.style.opacity = "1";
    }
  }

  if (autoarbitrage) {
    // Автоматический режим
    const maxAmount: number = Math.min(
      parseFloat(String(apiResult.maxAmount)) /
        parseFloat(String(apiResult.price)) || 0
    );
    if (amountInput) {
      amountInput.value = maxAmount.toFixed(4);
    }
    handleAmountChange();
    if (validateAndToggleButton()) {
      executeTrade();
    }
    return;
  }

  // === Ручной режим (старое поведение) ===
  amountInput?.addEventListener("input", handleAmountChange);
  receiveInput?.addEventListener("input", () => {
    if (!amountInput || !receiveInput) return;
    const receiveValue: number = parseFloat(receiveInput.value) || 0;
    const amountValue: number = price > 0 ? receiveValue / price : 0;
    amountInput.value = amountValue.toFixed(4);
    validateAndToggleButton();
  });
  receiveInput?.addEventListener("blur", () => {
    if (receiveInput) {
      const currentValue: number = parseFloat(receiveInput.value) || 0;
      receiveInput.value = currentValue.toFixed(2);
    }
  });

  maxButton?.addEventListener("click", () => {
    const maxAmount: number = Math.min(
      parseFloat(String(apiResult.maxAmount)) /
        parseFloat(String(apiResult.price)) || 0
    );
    if (amountInput) {
      amountInput.value = maxAmount.toFixed(4);
    }
    validateAndToggleButton();
  });

  tradeButton?.addEventListener("click", executeTrade);
  cancelButton?.addEventListener("click", () => closeModal());
  closeButton?.addEventListener("click", () => closeModal());

  overlay?.addEventListener("click", (e: MouseEvent) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener(
    "keydown",
    function escHandler(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", escHandler);
      }
    }
  );
}
