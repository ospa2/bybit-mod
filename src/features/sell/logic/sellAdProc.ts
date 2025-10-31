// src/features/adEnhancements.ts

import { bestMerchants } from "../../../core/config";
import { adShouldBeFiltered } from "../../../shared/utils/adFilter";
import { filterRemark } from "../../../shared/utils/filterRemark";
import type { Ad } from "../../../shared/types/ads";
import type { ReviewStats } from "../../../shared/types/reviews";


// Хранилище уже кликнутых объявлений
const clickedAdIds = new Set<string>();
export function enhanceAdRows(ads: Ad[]) {
  let clickedThisPass = false;
  const storedStatsRaw = localStorage.getItem("reviewsStatistics_v1")
  let storedStats: ReviewStats[] = [];
  if (storedStatsRaw) {
    storedStats = JSON.parse(storedStatsRaw);
  }

  // Чтобы за один проход был только один авто-клик

  document.querySelectorAll(".trade-table__tbody tr").forEach((row, i) => {
    const ad = ads[i];
    if (!ad) return;

    if (adShouldBeFiltered(ad)) {
      row.classList.add("filtered-ad");
      return;
    }
    console.log('clickedThisPass:', clickedThisPass);

    // Авто-клик по лучшим мерчантам
    if (
      !clickedThisPass && // кликаем только один раз за проход
      bestMerchants.includes(ad.userId) &&
      !clickedAdIds.has(ad.id) // проверяем, что по этому объявлению еще не кликали
    ) {
      clickedThisPass = true;
      const sellBtn = row.querySelector<HTMLElement>(
        ".trade-list-action-button button"
      );
      const modal = document.querySelector(
        '[role="dialog"], [aria-modal="true"]'
      ) as HTMLElement;
      if (sellBtn && !modal) {
        sellBtn.click();
        clickedAdIds.add(ad.id); // запоминаем, что кликнули
      }
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
  const negativeCount = stat.allReviewsLength ?? "x";
  const positiveCount = stat.goodReviewsCount ?? "x";
  let highlightedColor = highlightedCount === 0 ? "#27F54D" : "#DC143C";
  (negativeCount <= 3 && highlightedCount === 0 && positiveCount > 150)
    ? (highlightedColor = "#27e4f5ff")
    : highlightedColor;

  const negativeColor =
    negativeCount <= 3 && highlightedCount === 0 && positiveCount > 150
      ? "#27e4f5ff"
      : "#000000ff";

  statsDiv.innerHTML = `
        <div style="display:grid; gap:8px; margin-top:4px;">
            <span>+<strong>${stat.goodReviewsCount ?? "x"}</strong></span>
            <span>-<strong style="color:${negativeColor}">${stat.allReviewsLength ?? "x"}</strong></span>
            <span><strong style="color:${highlightedColor}">${highlightedCount}</strong></span>
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
