import { disableBodyScroll, enableBodyScroll } from "../utils/domHelpers.ts";
import { loadAndDisplayReviews } from "./review.ts";
import { startPriceTimer } from "../utils/priceTimer.ts";
import { showNotification } from "../utils/notifications.ts";
import { paymentNames } from "../config.ts";
import type { Ad, ApiResult, CreateResponse } from "../types/ads";
import { findBuyCard, type Card } from "../automation/adFinder.ts";
import { watchOrder } from "../api/sellInterceptor.ts";

export interface OrderPayload {
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

export interface Order {
   "Order No.": string;
   Type: string;
   "Fiat Amount": string;
   Price: string | number;
   "Coin Amount": string;
   Counterparty: string;
   Status: string;
   Time: string;
}

export async function openTradingModal(data: { ad: Ad; card: Card | null }, minPrice?: number, autoarbitrage?: boolean) {
   const ad = data.ad;

   if (!ad) {
      return;
   }
   // 1. --- создаем модальное окно только в мануальном режиме ---
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
      modal.innerHTML = /* html */ `
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
                               ad.isOnline ? "online" : ""
                            }">${(ad.nickName || "U")
         .charAt(0)
         .toUpperCase()}</div>
                        </div>
                        <div class="advertiser-info">
                            <div class="advertiser-name">${
                               ad.nickName || "Unknown"
                            }</div>
                            <div class="advertiser-stats">
                                <span>${
                                   ad.finishNum || 0
                                } исполнено</span><span class="stats-divider">|</span><span>${
         ad.recentExecuteRate || 0
      }%</span>
                            </div>
                            <div class="online-status">${
                               ad.isOnline ? "Онлайн" : "Офлайн"
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
                               ad.minAmount || "0"
                            ).toLocaleString("ru-RU")} ~ ${parseFloat(
         ad.maxAmount || "0"
      ).toLocaleString("ru-RU")} ${ad.currencyId || "RUB"}</span>
                        </div>
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Длительность оплаты</span>
                            <span class="crypto-info-value">${
                               ad.paymentPeriod || 15
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
                    <div class="price-value">${parseFloat(ad.price).toFixed(
                       2
                    )} ${ad.currencyId || "RUB"}</div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я ${
                       ad.side === 1 ? "куплю" : "продам"
                    }</label>
                    <div class="input-container" id="amount-container">
                        <div class="input-wrapper">
                            <input type="text" class="amount-input" id="amount-input" placeholder="0.0000" autocomplete="off">
                            <div class="input-suffix">
                                <span>${
                                   ad.tokenId || "USDT"
                                }</span><span class="input-divider">|</span><button type="button" class="max-button" id="max-button">Все</button>
                            </div>
                        </div>
                    </div>
                    <div class="balance-info" id="available-for-trade">Доступно для ${
                       ad.side === 1 ? "покупки" : "продажи"
                    }: <span class="spinner small"></span></div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я получу</label>
                    <div class="input-container"><div class="input-wrapper">
                        <div style="width: 24px;">₽</div>
                        <input type="text" class="amount-input" id="receive-input" placeholder="0.00">
                        <div class="input-suffix"><span>${
                           ad.currencyId || "RUB"
                        }</span></div>
                    </div></div>
                </div>
                <div class="payment-section">
                    <label class="input-label">Способ оплаты</label>
                    <div class="payment-methods">
                        ${
                           ad.payments && ad.payments.length > 0
                              ? ad.payments
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
                       ad.side === 1 ? "Купить" : "Продать"
                    } ${ad.tokenId || "USDT"}</button>
                    <button type="button" class="cancel-button" id="cancel-button">Отмена</button>
                </div>
            </div>
        </div>
    `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      document.body.style.overflow = "hidden";

      // Запускаем асинхронную загрузку отзывов
      loadAndDisplayReviews(ad);
      startPriceTimer();
   }

   // 2. --- ФАЗА ФОНОВОЙ ЗАГРУЗКИ И ОБНОВЛЕНИЯ ---
   try {
      const payload = { item_id: ad.id, shareCode: null };
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
      apiResult.side = ad.side;
      apiResult.nickName = ad.nickName;
      if (data.card === null && minPrice) {
         data.card = findBuyCard(ad, minPrice);
      }

      // ВАЖНО: Только теперь, когда все данные загружены, мы "оживляем" модальное окно
      if (data.card && autoarbitrage) {
         setupModalEvents(apiResult, data.card, autoarbitrage);
      }
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

export function setupModalEvents(apiResult: ApiResult, card: Card, autoarbitrage: boolean): void {

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
         quantity: amountInput
            ? parseFloat(amountInput.value).toString()
            : (parseFloat(apiResult.maxAmount) / parseFloat(apiResult.price))
                 .toFixed(4)
                 .toString(), //USDT
         amount: amountInput
            ? (
                 parseFloat(amountInput.value) *
                 parseFloat(String(apiResult.price))
              )
                 .toFixed(2)
                 .toString()
            : apiResult.maxAmount, //RUB
         curPrice: apiResult.curPrice,
         flag: "amount",
         version: "1.0",
         securityRiskToken: "",
         isFromAi: false,
      };
   }

   // ==== Сохранение нового ордера ====
   async function saveBuyOrder(orderId: string, card: Card): Promise<void> {
      let orders: { order: Order; card: Card }[] = JSON.parse(
         localStorage.getItem("orders") || "[]"
      );
      let cards: Card[] = JSON.parse(localStorage.getItem("cards_v1") || "[]");

      const newOrder: Order = {
         "Order No.": orderId,
         Type: "BUY",
         "Fiat Amount": amountInput
            ? (
                 parseFloat(amountInput.value) *
                 parseFloat(String(apiResult.price))
              )
                 .toFixed(2)
                 .toString()
            : "0",
         Price: apiResult.price,
         "Coin Amount": amountInput
            ? parseFloat(amountInput.value).toString()
            : "0",
         Counterparty: apiResult.nickName,
         Status: "pending", // <-- ключевое изменение
         Time: new Date().toISOString(),
      };

      const maxAmount = parseFloat(apiResult.maxAmount);

      // запускаем вотчер сразу
      if (card) {
         watchOrder(orderId, card);
      }

      // обновляем карты
      cards = cards.map((c) =>
         c.id === card?.id
            ? {
                 ...c,
                 balance: c.balance - maxAmount,
                 turnover: c.turnover + maxAmount,
              }
            : c
      );
      localStorage.setItem("cards_v1", JSON.stringify(cards));

      // сохраняем ордер локально
      orders.push({ order: newOrder, card: card });
      localStorage.setItem("orders", JSON.stringify(orders));
   }

   async function executeTrade(): Promise<void> {
      if (!tradeButton && !autoarbitrage) return;
      const originalText: string = tradeButton?.textContent || "";
      if (tradeButton) {
         tradeButton.disabled = true;

         tradeButton.textContent = "Отправка заявки...";
         tradeButton.style.opacity = "0.6";
      }
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

         const response: Response = await fetch(
            "https://www.bybit.com/x-api/fiat/otc/order/create",
            {
               method: "POST",
               headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
               },
               credentials: "include",
               body: JSON.stringify("orderPayload"),
            }
         );

         const result: CreateResponse = await response.json();

         if (response.ok && result.ret_code === 0 && card) {
            await saveBuyOrder(result.result.orderId, card);

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
         if (tradeButton) {
            tradeButton.disabled = false;
            tradeButton.textContent = originalText;
            tradeButton.style.opacity = "1";
         }
      }
   }

   if (autoarbitrage) {
      // Автоматический режим
      const maxAmount: number = Math.min(
         parseFloat(String(apiResult.maxAmount)) /
            parseFloat(String(apiResult.price))
      );
      if (amountInput) {
         amountInput.value = maxAmount.toFixed(4);
      }

      handleAmountChange();
      executeTrade();

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
