// src/features/adEnhancements.ts

import { bestMerchants } from "../../../core/config";
import { filterRemark } from "../../../shared/utils/filterRemark";
import type { Ad } from "../../../shared/types/ads";
import type { ReviewStats } from "../../../shared/types/reviews";
import { sendTelegramMessage } from "../api/telegramNotifier";
import { AutoClickElements } from "../automation/autoсlicker";


// Хранилище уже кликнутых объявлений
const clickedAds = new Set<string>();
export function enhanceAdRows(ads: Ad[]) {
  let clickedThisPass = false;
  const storedStatsRaw = localStorage.getItem("reviewsStatistics_v1")
  let storedStats: ReviewStats[] = [];
  if (storedStatsRaw) {
    storedStats = JSON.parse(storedStatsRaw);
  }

  // Чтобы за один проход был только один авто-клик

  document.querySelectorAll(".trade-table__tbody tr").forEach((row, i) => {
    const ad = ads[i - 1];
    if (!ad) return;


    // Авто-клик по лучшим мерчантам
    if (bestMerchants.includes(ad.userId)) {
      console.log('ad: ', ad.nickName, ad.price, ad.maxAmount, clickedAds.has(ad.id));
    }
    const modal = document.querySelector(
      '[role="dialog"], [aria-modal="true"]'
    ) as HTMLElement;
    if (
      !clickedThisPass && // кликаем только один раз за проход
      bestMerchants.includes(ad.userId) &&
      !clickedAds.has(ad.id) && // проверяем, что по этому объявлению еще не кликали
      !modal
    ) {
      // 1. Проверяем, есть ли разрешение 
      const sellBtn = row.querySelector<HTMLElement>(
        ".trade-list-action-button button"
      );

      if (sellBtn) {
        sellBtn.click();
        clickedAds.add(ad.id); // запоминаем, что кликнули

        if ((window as any).autoClicker) {
          AutoClickElements.clickEveryButtonExceptOne((window as any).autoClicker);
        }
        if (Notification.permission === "granted") {
          // 2. Если есть, показываем уведомление
          new Notification("Новый ордер на продажу", {
            body: `от ${ad.nickName} на ${ad.maxAmount} руб. `,
            icon: 'URL_картинки' // Опционально
          });
        } else if (Notification.permission !== "denied") {
          // 3. Если нет, запрашиваем разрешение
          Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
              new Notification("Web API Уведомление", {
                body: "Спасибо за разрешение! Уведомление показано."
              });
            }
          });
        }
        sendTelegramMessage(ad)
        clickedThisPass = true;
      }

      setTimeout(() => AutoClickElements.findAndClickCancel((window as any).autoClicker), 60 * 1000);
    }

    // Вставка статистики и условий
    const stat = storedStats.find((s: ReviewStats) => s.userId === ad.userId);

    if (stat) {
      addStatsToRow(row as HTMLElement, stat);
    }

    addRemarkToRow(row as HTMLElement, ad.remark);
  });

}


function addStatsToRow(row: HTMLElement, stat: ReviewStats) {
  const target = row.querySelector(".moly-space-item.moly-space-item-first");

  if (!target) return;

  let statsDiv = target.nextElementSibling;
  if (!statsDiv || !statsDiv.classList.contains("review-stats")) {
    statsDiv = document.createElement("div");
    statsDiv.className = "review-stats";
    // ... стили ...
    target.insertAdjacentElement("afterend", statsDiv);
  }

  const highlightedCount = stat.highlightedCount ?? "x";
  const negativeCount = stat.badReviewsCount ?? "x";
  const positiveCount = stat.goodReviewsCount ?? "x";
  let highlightedColor = highlightedCount === 0 ? "#27F54D" : "#DC143C";
  (negativeCount <= 3 && highlightedCount === 0 && positiveCount > 150)
    ? (highlightedColor = "#27e4f5ff")
    : highlightedColor;

  const negativeColor =
    negativeCount <= 3 && highlightedCount === 0 && positiveCount > 150
      ? "#27e4f5ff"
      : "#000000ff";

  statsDiv.innerHTML = /* html */ `
  <div style="display:grid; gap:8px; margin-top:4px; font-weight:700;">
      <div>+${stat.goodReviewsCount ?? "x"}</div>
      <div style="color:${negativeColor}">-${stat.badReviewsCount ?? "x"}</div>
      <div style="color:${highlightedColor}">${highlightedCount}</div>
  </div>
`;


  row.classList.add("has-review-stats");
}

function addRemarkToRow(row: HTMLElement, remark: string) {
  const remarkCell = document.createElement("td");
  // ... стили ...
  remarkCell.innerHTML = `
        <div class="lorem-content">
            <p style="margin: 0; width: 300px; font-size: 14px; line-height: 1.4; color: #666;">
                ${filterRemark(remark)}
            </p>
        </div>
    `;

  // Удаляем старую ячейку с условиями, если она есть
  if (row.children.length > 5) {
    row.children[1].remove();
  }
  // Вставляем новую
  if (row.children[1] && row.children.length <= 5) {
    row.insertBefore(remarkCell, row.children[1]);
  }
}
