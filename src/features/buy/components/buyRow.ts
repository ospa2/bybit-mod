//import { filterRemark } from "../../../shared/utils/filterRemark";
import { openBuyModal } from "./buyModal";
import { paymentNames, paymentColors } from "../../../core/config";
import type { Ad } from "../../../shared/types/ads";
import { findBuyCard } from "../automation/adFinder";
import { availableBanks } from "../../../shared/utils/bankParser";

export function createRowFromTemplate(ad: Ad, minPrice?: number): ChildNode | null {
   function getPaymentStyle(paymentId: string): string {
      const color =
         paymentColors[paymentId.toString() as keyof typeof paymentColors];
      return color ? `background-color: ${color}; color: white;` : "";
   }

   const filteredRemark = ad.remark//легаси 

   let card = findBuyCard(ad, minPrice || 0);

   const rowHTML = /*html*/ `
        <div class="dynamic-row" style="display: contents;">
            <div class="table-row" style="display: table-row;">
                <div class="table-cell" style="display: table-cell; width: 500px; padding: 16px; vertical-align: middle;">
                    <div class="moly-space flex items-center" style="gap: 16px;">
                        <div class="moly-space-item moly-space-item-first moly-space-item-last">
                            <div class="moly-space flex-col inline-flex moly-space-vertical items-start" style="gap: 0px;">
                                <div class="moly-space-item moly-space-item-first">
                                    <div class="moly-space flex items-center" style="gap: 0px;">
                                        <div class="moly-space-item moly-space-item-first">
                                            <div class="by-avatar by-avatar--${ad.isOnline
         ? "online"
         : "offline"
      } small">
                                                <div class="by-avatar__container">
                                                    <div class="by-avatar__container__letter">${ad.nickName
         ?.charAt(0)
         .toUpperCase() ?? "U"
      }</div>
                                                    <div class="by-avatar__container__status"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="moly-space-item">
                                            <div class="inline-block">
                                                <div class="advertiser-name">
                                                    <span>${ad.nickName || "Unknown"
      }</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="moly-space-item moly-space-item-last">
                                            <div class="inline-block">
                                                ${ad.authTag?.length
         ? ad.authTag
            .map(
               () =>
                  `<img src="/fiat/trade/gw/static/media/vaSilverIcon.8a83d2497a7eccc3612a.png" class="advertiser-auth-tag pointer">`
            )
            .join("")
         : ""
      }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="moly-space-item">
                                    <div class="advertiser-info">
                                        <span>${ad.finishNum ?? 0
      }&nbsp;исполнено</span>
                                        <span class="delimiter">|</span>
                                        <div class="inline-block">
                                            <span class="execute-rate">${ad.recentExecuteRate ?? 0
      }&nbsp;% | ${ad.paymentPeriod ?? 15
      } мин.</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="moly-space-item moly-space-item-last">
                                    <div class="moly-space flex items-baseline" style="gap: 16px;">
                                        <div class="moly-space-item moly-space-item-first" style="margin-top: 6px;">
                                            <div class="inline-block" style="max-width: 400px;">
                                                <span
                                                   class="moly-text text-[var(--bds-gray-t2)] font-[400] inline cursor-text transition-colors duration-300"
                                                   ondblclick="
                                                      navigator.clipboard.writeText(this.textContent.trim());
                                                      this.classList.add('copied');
                                                      setTimeout(() => this.classList.remove('copied'), 800);
                                                   "
                                                   >
                                                   <img
                                                      src="/fiat/trade/gw/static/media/clock.8fb8bc6c6fe17cf175ba8a0abda873f5.svg"
                                                      alt=""
                                                      width="14"
                                                      style="vertical-align: -2px;"
                                                   >
                                                   ${filteredRemark}
                                                   </span>



                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="table-cell" style="display: table-cell; min-width: 120px; max-width: 180px; padding: 16px; vertical-align: middle;">
                    <span class="price-amount">
                        ${parseFloat(ad.price ?? "0").toFixed(
         2
      )} <span class="price-unit">${ad.currencyId ?? "RUB"
      }</span>
                    </span>
                </div>
                <div class="table-cell" style="display: table-cell; min-width: 220px; padding: 16px; vertical-align: middle;">                     
                    <div class="ql-value">${parseFloat(
         ad.minAmount ?? "0"
      ).toLocaleString("ru-RU", {
         minimumFractionDigits: 2,
      })}&nbsp;~&nbsp;${parseFloat(
         ad.maxAmount ?? "0"
      ).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} ${ad.currencyId ?? "RUB"
      }</div>
                </div>
                <div class="table-cell" style="display: table-cell; width: 196px; padding: 16px; vertical-align: middle;">
                    ${availableBanks(ad.remark)
         ?.slice(0, 3)
         .map(
            (paymentId) =>
               `<div class="inline-block"><div class="trade-list-tag" style="${getPaymentStyle(
                  paymentId
               )}">${paymentNames[
               paymentId as keyof typeof paymentNames
               ] ?? paymentId
               }</div></div>`
         )
         .join("") ??
      '<div class="inline-block"><div class="trade-list-tag">Не указано</div></div>'
      }
                </div>
                <div class="table-cell trade-list-action-button" style="display: table-cell; padding: 16px; vertical-align: middle;">
                    <button class="moly-btn ${card
         ? "bg-greenColor-bds-green-700-normal"
         : "bg-gray-500"
      }
 text-base-bds-static-white px-[16px] py-[8px] rounded">
                        <span>${card ? card.id : "нет карт"}</span>
                    </button>
                 
                </div>
            </div>
        </div>
    `;

   const tempDiv = document.createElement("div");
   tempDiv.innerHTML = rowHTML.trim();
   const newRow = tempDiv.firstChild;

   // --- Вспомогательные функции для попапа ---
   function removeExistingPricePopup(): void {
      const existing = document.querySelector(".price-popup");
      if (existing) existing.remove();
   }


   function showPricePopup(anchorElem: HTMLElement, valueStr: string): void {
      removeExistingPricePopup();
      const popup = document.createElement("div");
      popup.className = "price-popup";
      Object.assign(popup.style, {
         position: "absolute",
         padding: "8px 10px",
         borderRadius: "6px",
         boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
         background: "white",
         color: "black",
         fontSize: "13px",
         zIndex: "99999",
         whiteSpace: "nowrap",
         transition: "opacity 0.12s ease",
         opacity: "0",
         pointerEvents: "none", // чтобы не мешал hover'у
      });
      popup.innerHTML = `
   <div style="display: flex; flex-direction: column; gap: 4px;">
      <div><strong>+3%:</strong> ${(parseFloat(valueStr) * 1.03).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div><strong>+4%:</strong> ${(parseFloat(valueStr) * 1.04).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div><strong>+5%:</strong> ${(parseFloat(valueStr) * 1.05).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div><strong>+6%:</strong> ${(parseFloat(valueStr) * 1.06).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div><strong>+7%:</strong> ${(parseFloat(valueStr) * 1.07).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
   </div>
`;


      document.body.appendChild(popup);
      const rect = anchorElem.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const margin = 8;
      let top = rect.top + window.scrollY - popupRect.height - margin;
      let left =
         rect.left + window.scrollX + (rect.width - popupRect.width) / 2;
      if (left < 8) left = 8;
      if (
         left + popupRect.width >
         window.scrollX + document.documentElement.clientWidth - 8
      ) {
         left =
            window.scrollX +
            document.documentElement.clientWidth -
            popupRect.width -
            8;
      }
      if (top < window.scrollY + 8) top = rect.bottom + window.scrollY + margin;

      popup.style.left = `${Math.round(left)}px`;
      popup.style.top = `${Math.round(top)}px`;

      requestAnimationFrame(() => {
         popup.style.opacity = "1";
      });
   }

   // --- Обработчики ---
   (newRow as HTMLElement)
      .querySelector("button")
      ?.addEventListener("click", () => {
         let card = null
         if (minPrice) {
            card = findBuyCard(ad, minPrice)
            console.log("🚀 ~ createRowFromTemplate ~ card:", card)
            openBuyModal({ ad: ad, card: card }, minPrice, false);
         }

      });

   const priceSpan = (newRow as HTMLElement).querySelector<HTMLElement>(
      ".price-amount"
   );
   if (priceSpan) {
      priceSpan.style.cursor = "pointer";

      const priceNum = parseFloat(ad.price ?? "0") || 0;
      const bumped = priceNum
      const formatted =
         bumped.toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
         }) +
         " " +
         (ad.currencyId ?? "RUB");

      priceSpan.addEventListener("mouseenter", () => {
         showPricePopup(priceSpan, formatted);
      });

      priceSpan.addEventListener("mouseleave", () => {
         removeExistingPricePopup();
      });

   }

   return newRow;
}
