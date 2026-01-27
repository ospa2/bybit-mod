// src/features/buy/components/buyModalDOM.ts

import { enableBodyScroll } from "../../../shared/utils/domHelpers.ts";
import type { Ad } from "../../../shared/types/ads";

export function closeModal(): void {
    const overlay = document.querySelector(".bybit-modal-overlay");
    if (overlay) {
        overlay.remove();
    }
    document.body.style.overflow = "";
    enableBodyScroll();
}

/**
 * Создает HTML-структуру модального окна.
 */
export function createModalHTML(ad: Ad): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "bybit-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "bybit-modal";
    const balance = localStorage.getItem("curbal");
    // ⭐ Весь ваш HTML-шаблон переносится сюда
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
                               <div class="avatar ${ad.isOnline ? "online" : ""
        }">${(ad.nickName || "U")
            .charAt(0)
            .toUpperCase()}</div>
                           </div>
                           <div class="advertiser-info">
                               <div class="advertiser-name">${ad.nickName || "Unknown"
        }</div>
                               <div class="advertiser-stats">
                                   <span>${ad.finishNum || 0
        } исполнено</span><span class="stats-divider">|</span><span>${ad.recentExecuteRate || 0
        }%</span>
                               </div>
                               <div class="online-status">${ad.isOnline ? "Онлайн" : "Офлайн"
        }</div>
                           </div>
                       </div>
                       <div class="verification-tags">
                           <div class="verification-tag">Эл. почта</div><div class="verification-tag">SMS</div><div class="verification-tag">Верификация личности</div>
                       </div>
                       <div class="crypto-info-section">
                           <div class="crypto-info-item">
                               <span class="crypto-info-label">Доступно</span>
                               <span class="crypto-info-value" id="balance-value">${balance} USDT</span>
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
                               <span class="crypto-info-value">${ad.paymentPeriod || 15
        } мин.</span>
                           </div>
                       </div>
                   </div>
                   <div class="terms-section">
                       <div class="terms-title" id="reviews-titleee">Хороших отзывов: ...</div>
                       <div class="terms-content" id="reviews-container"><div class="loader"></div></div>
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
                       <label class="input-label">Я куплю</label>
                       <div class="input-container" id="amount-container">
                           <div class="input-wrapper">
                               <input type="text" class="amount-input" id="amount-input" placeholder="0.0000" autocomplete="off">
                               <div class="input-suffix">
                                   <span>USDT
        </span><span class="input-divider">|</span><button type="button" class="max-button" id="max-button">Все</button>
                               </div>
                           </div>
                       </div>
                       <div class="balance-info" id="available-for-trade">Доступно для покупки: ${balance} USDT</div>
                   </div>
                   <div class="input-section">
                       <label class="input-label">Я получу</label>
                       <div class="input-container"><div class="input-wrapper">
                           <div style="width: 24px;">₽</div>
                           <input type="text" class="amount-input" id="receive-input" placeholder="0.00">
                           <div class="input-suffix"><span>RUB
        }</span></div>
                       </div></div>
                   </div>
                   <div class="payment-section">
                       <label class="input-label">Способ оплаты</label>
                       <div class="payment-methods">
                           ${ad.payments && ad.payments.length > 0
            ? ad.payments
                .map(
                    (paymentName) =>
                        `<span class="payment-method">${paymentName
                        }</span>`
                )
                .join("")
            : '<span class="payment-method">Не указано</span>'
        }
                       </div>
                   </div>
                   <div class="button-section">
                       <button type="button" class="trade-button" id="trade-button" disabled>${ad.side === 1 ? "Купить" : "Продать"
        } ${ad.tokenId || "USDT"}</button>
                       <button type="button" class="cancel-button" id="cancel-button">Отмена</button>
                   </div>
               </div>
           </div>
       `;

    overlay.appendChild(modal);
    return overlay;
}

/**
 * Настраивает базовые события закрытия.
 */
export function setupInitialModalEvents(overlay: HTMLElement): void {
    const closeButton = overlay.querySelector(".bybit-modal-close") as HTMLButtonElement;
    const cancelButton = overlay.querySelector("#cancel-button") as HTMLButtonElement;
    const receiveInput = overlay.querySelector("#receive-input") as HTMLInputElement;

    // События закрытия
    cancelButton?.addEventListener("click", closeModal);
    closeButton?.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e: MouseEvent) => {
        if (e.target === overlay) closeModal();
    });

    // Событие форматирования ввода
    receiveInput?.addEventListener("blur", () => {
        if (receiveInput) {
            const currentValue: number = parseFloat(receiveInput.value) || 0;
            receiveInput.value = currentValue.toFixed(2);
        }
    });

    // Обработка Escape
    document.addEventListener("keydown", function escHandler(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            closeModal();
            document.removeEventListener("keydown", escHandler);
        }
    });
}