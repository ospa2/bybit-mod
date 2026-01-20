//import { filterRemark } from "../../../shared/utils/filterRemark";
import { openBuyModal } from "./buyModal";
import { paymentColors } from "../../../core/config";
import type { Ad } from "../../../shared/types/ads";
import { availableBanks } from "../../../shared/utils/bankParser";
import { findBuyCard } from "../automation/buyAdSelector";

export function createRowFromTemplate(ad: Ad, minPrice?: number): ChildNode | null {
    function getPaymentStyle(paymentId: string): string {
        const color = (paymentColors as any)[paymentId];
        if (!color) return "";
        const isGradient = color.includes('gradient');
        return `${isGradient ? 'background' : 'background-color'}: ${color}; color: white;`;
    }

    const card = findBuyCard(ad, minPrice || 0);

    const rowHTML = /*html*/ `
        <div class="dynamic-row" style="display: contents;">
            <div class="table-row" style="display: table-row;">
                <div class="table-cell" style="display: table-cell; width: 500px; padding: 16px; vertical-align: middle;">
                    <div class="moly-space flex items-center" style="gap: 16px;">
                        <div class="moly-space-item">
                            <div class="moly-space flex-col inline-flex items-start">
                                <div class="moly-space-item">
                                    <div class="moly-space flex items-center">
                                        <div class="moly-space-item">
                                            <div class="by-avatar by-avatar--${ad.isOnline ? "online" : "offline"} small">
                                                <div class="by-avatar__container">
                                                    <div class="by-avatar__container__letter">${ad.nickName?.charAt(0).toUpperCase() ?? "U"}</div>
                                                    <div class="by-avatar__container__status"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="moly-space-item">
                                            <div class="advertiser-name"><span>${ad.nickName || "Unknown"}</span></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="moly-space-item">
                                    <div class="advertiser-info">
                                        <span>${ad.finishNum ?? 0}&nbsp;исполнено</span>
                                        <span class="delimiter">|</span>
                                        <span class="execute-rate">${ad.recentExecuteRate ?? 0}&nbsp;% | ${ad.paymentPeriod ?? 15} мин.</span>
                                    </div>
                                </div>
                                <div class="moly-space-item">
                                     <span class="moly-text text-[var(--bds-gray-t2)] font-[400] text-xs">
                                        <img src="/fiat/trade/gw/static/media/clock.8fb8bc6c6fe17cf175ba8a0abda873f5.svg" width="14" style="vertical-align: -2px;">
                                        ${ad.remark}
                                     </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="table-cell" style="display: table-cell; min-width: 120px; padding: 16px; vertical-align: middle;">
                    <span class="price-amount js-price-container" style="cursor: pointer;">
                        <span class="js-price-value">${parseFloat(ad.price ?? "0").toFixed(2)}</span> 
                        <span class="price-unit">${ad.currencyId ?? "RUB"}</span>
                    </span>
                </div>
                <div class="table-cell" style="display: table-cell; min-width: 220px; padding: 16px; vertical-align: middle;">
                    <div class="ql-value">
                        ${parseFloat(ad.minAmount ?? "0").toLocaleString("ru-RU", { minimumFractionDigits: 2 })}&nbsp;~&nbsp;${parseFloat(ad.maxAmount ?? "0").toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${ad.currencyId ?? "RUB"}
                    </div>
                </div>
                <div class="table-cell" style="display: table-cell; width: 196px; padding: 16px; vertical-align: middle;">
                    ${(availableBanks(ad.remark)?.slice(0, 3).map(name => `
                        <div class="inline-block">
                            <div class="trade-list-tag" style="${getPaymentStyle(name)}">${name}</div>
                        </div>
                    `).join("")) || '<div class="inline-block"><div class="trade-list-tag">Не указано</div></div>'}
                </div>
                <div class="table-cell trade-list-action-button" style="display: table-cell; padding: 16px; vertical-align: middle;">
                    <button class="moly-btn ${card ? "bg-greenColor-bds-green-700-normal" : "bg-gray-500"} text-base-bds-static-white px-[16px] py-[8px] rounded">
                        <span>${card ? card.id : "нет карт"}</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rowHTML.trim();
    const newRow = tempDiv.firstChild as HTMLElement;

    // Регистрация событий (только один раз при создании)
    newRow.querySelector("button")?.addEventListener("click", () => {
        const currentMinPrice = parseFloat(localStorage.getItem("minPrice") || "0");
        const currentCard = findBuyCard(ad, currentMinPrice);
        openBuyModal({ ad, card: currentCard }, currentMinPrice, false);
    });

    const priceSpan = newRow.querySelector(".price-amount") as HTMLElement;
    if (priceSpan) {
        priceSpan.addEventListener("mouseenter", () => {
            const val = priceSpan.querySelector('.js-price-value')?.textContent || ad.price;
            showPricePopup(priceSpan, val);
        });
        priceSpan.addEventListener("mouseleave", removeExistingPricePopup);
    }

    return newRow;
}

// Вспомогательные функции для Popup (без изменений)
function removeExistingPricePopup() {
    document.querySelector(".price-popup")?.remove();
}

function showPricePopup(anchor: HTMLElement, valueStr: string) {
    removeExistingPricePopup();
    const popup = document.createElement("div");
    popup.className = "price-popup";
    const priceNum = parseFloat(valueStr);

    Object.assign(popup.style, {
        position: "absolute", padding: "8px 10px", borderRadius: "6px",
        background: "white", color: "black", fontSize: "13px", zIndex: "99999",
        boxShadow: "0 6px 18px rgba(0,0,0,0.12)", pointerEvents: "none"
    });

    const rows = [3, 4, 5, 6, 7].map(pct => `
        <div><strong>+${pct}%:</strong> ${(priceNum * (1 + pct / 100)).toLocaleString("ru-RU", { minimumFractionDigits: 2 })}</div>
    `).join('');

    popup.innerHTML = `<div style="display: flex; flex-direction: column; gap: 4px;">${rows}</div>`;
    document.body.appendChild(popup);

    const rect = anchor.getBoundingClientRect();
    popup.style.left = `${rect.left + window.scrollX}px`;
    popup.style.top = `${rect.top + window.scrollY - popup.offsetHeight - 8}px`;
}
