import { analyzeReview } from "../logic/reviewAnalyzer.ts";
import type { Review, ReviewStats } from "../../../shared/types/reviews";
import type { Ad } from "../../../shared/types/ads";
import { fetchBalance, fetchReviewsData } from "../api/reviewsApi.ts";
import reviewsStatistics from "../../../shared/storage/storageHelper.ts";
import { convertBybitTime } from "../../../shared/utils/timeStuff.ts";
import { calculatePriority } from "../logic/procHelper.ts";
function createReviewHTML(review: Review, className: string) {

   const analysis = analyzeReview(review.appraiseContent);
   const highlightClass = analysis.shouldHighlight ? "highlighted-review" : "";
   const formattedDate = convertBybitTime(review.updateDate);

   return `
        <li class="${className} ${highlightClass}">
            <p class="review-text">${formattedDate}: ${review.appraiseContent}</p>
        </li>
    `;
}


export async function loadAndDisplayReviews(originalAd: Ad) {
   const reviewsContainer = document.getElementById("reviews-container");
   console.log("reviewsContainer:", reviewsContainer);

   try {
      // --- 1. ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ДАННЫХ ---
      // Вызываем новую асинхронную функцию для загрузки отзывов
      const { negativeReviews, positiveReviewsCount } =
         await fetchReviewsData(originalAd.userId);
      const currentBalance = await fetchBalance()
      localStorage.setItem(
         "curbal",
         currentBalance.toString()
      )
      const balanceValueEl = document.getElementById("balance-value");
      const availableForTradeEl = document.getElementById(
         "available-for-trade"
      );

      // Исправлено: Используем конкатенацию или метод .toString() для преобразования числа в строку
      if (balanceValueEl) {
         balanceValueEl.textContent =
            (currentBalance || 0).toString() + " USDT";
      }

      if (availableForTradeEl) {
         availableForTradeEl.textContent = `Доступно для ${originalAd.side === 1 ? "покупки" : "продажи"
            }: ${(currentBalance || 0).toString()} ${originalAd.tokenId || "USDT"
            }`;
      }

      // --- 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ---

      // Обновляем баланс (код без изменений)
      const balanceElement = document.getElementById("balance-value");
      if (balanceElement) {
         balanceElement.textContent = `${currentBalance.toLocaleString(
            "ru-RU",
            { minimumFractionDigits: 4, maximumFractionDigits: 4 }
         )} ${originalAd.tokenId || "USDT"}`;
      }
      const titleElement = document.getElementById("reviews-titleee");

      if (titleElement) {
         titleElement.textContent = `Хороших отзывов: ${positiveReviewsCount}`;
      }

      const availableBalanceElement = document.getElementById(
         "available-for-trade"
      );
      if (availableBalanceElement) {
         availableBalanceElement.textContent = `Доступно для ${originalAd.side === 1 ? "покупки" : "продажи"
            }: ${currentBalance.toLocaleString("ru-RU", {
               minimumFractionDigits: 4,
            })} ${originalAd.tokenId || "USDT"}`;
      }

      // --- БЛОК ФОРМИРОВАНИЯ HTML (рефакторинг с использованием map) ---
      let reviewsHTML = '<div class="no-reviews">Плохих отзывов нет</div>';
      let highlightedCount = 0;

      if (Array.isArray(negativeReviews) && negativeReviews.length > 0) {
         let filteredCount = 0;

         const reviewItemsHTML = negativeReviews
            .map((review) => {
               if (!review.appraiseContent) return ""; // Пропускаем отзывы без текста

               const analysis = analyzeReview(review.appraiseContent);
               if (analysis.shouldHide) {
                  filteredCount++;
                  return ""; // Возвращаем пустую строку для скрываемых отзывов
               }
               if (analysis.shouldHighlight) {
                  highlightedCount++;
               }

               return createReviewHTML(review, "review-item"); // Ваша функция генерации HTML для одного отзыва
            })
            .join(""); // Объединяем весь массив HTML-строк в одну

         if (reviewItemsHTML.trim()) {
            // Если после фильтрации остались отзывы
            const statsHTML =
               filteredCount > 0 || highlightedCount > 0
                  ? `
                    <div class="filter-info">                    
                        ${filteredCount > 0
                     ? `<span class="filtered-info">Скрыто спам-отзывов: ${filteredCount}</span>`
                     : ""
                  }
                        ${highlightedCount > 0
                     ? `<span class="highlighted-info">Подсвечено подозрительных: ${highlightedCount}</span>`
                     : ""
                  }
                    </div>
                `
                  : "";

            reviewsHTML = `${statsHTML}<ul class="reviews-list">${reviewItemsHTML}</ul>`;
         }
      }

      // --- СОХРАНЕНИЕ СТАТИСТИКИ ---
      const statsObject: ReviewStats = {
         highlightedCount,
         goodReviewsCount: positiveReviewsCount,
         badReviewsCount: negativeReviews.length,
         userId: originalAd.userId,
         lastUpdated: Date.now(),
         priority: calculatePriority({
            goodReviewsCount: positiveReviewsCount,
            highlightedCount
         }),
      };

      // Добавляем объект в статистику
      reviewsStatistics.add(statsObject);


      if (reviewsContainer) {
         reviewsContainer.innerHTML = reviewsHTML;
      }
   } catch (e) {
      console.error("Ошибка при подгрузке данных для модального окна:", e);
      if (reviewsContainer) {
         reviewsContainer.innerHTML =
            '<div class="no-reviews error">Не удалось загрузить отзывы.</div>';
      }
   }
}
