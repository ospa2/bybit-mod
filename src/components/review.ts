import { analyzeReview } from "../logic/reviewAnalyzer.ts";
import type { Review, ReviewStats } from "../types/reviews";
import type { Ad } from "../types/ads";
import { adShouldBeFiltered } from "../logic/adFilter.ts";
function createReviewHTML(review: Review, className: string) {
   function convertBybitTime(bybitTimestamp: string) {
      const bbtt = Number(bybitTimestamp);
      const date = new Date(bbtt);
      const d = String(date.getDate()).padStart(2, "0");
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const y = date.getFullYear();

      return `${d}.${m}.${y}`;
   }

   const analysis = analyzeReview(review.appraiseContent);
   const highlightClass = analysis.shouldHighlight ? "highlighted-review" : "";
   const formattedDate = convertBybitTime(review.updateDate);

   return `
        <li class="${className} ${highlightClass}">
            <p class="review-text">${formattedDate}: ${review.appraiseContent}</p>
        </li>
    `;
}

// --- Вспомогательная функция для загрузки всех страниц отзывов ПАРАЛЛЕЛЬНО ---
type FetchReviewsResult = {
   negativeReviews: Review[];
   positiveReviewsCount: number;
   currentBalance: number;
};

export async function fetchReviewsData(
   userId: string
): Promise<FetchReviewsResult> {
   const pageNumbers = Array.from({ length: 7 }, (_, i) => i + 1);

   // Запросы обычных и скрытых отзывов
   const reviewRequests = pageNumbers.map((page) => {
      const payload = {
         makerUserId: userId,
         page: page.toString(),
         size: "10",
         appraiseType: "0",
      };
      return fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
      }).then((res) => res.json());
   });

   const hiddenReviewRequests = pageNumbers.map((page) => {
      const payload = {
         makerUserId: userId,
         page: page.toString(),
         size: "10",
         appraiseType: "0",
         foldingDisplay: "1",
      };
      return fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
      }).then((res) => res.json());
   });

   // Баланс
   const balanceRequest = fetch(
      "https://www.bybit.com/x-api/fiat/otc/user/availableBalance",
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ tokenId: "USDT" }),
      }
   ).then((res) => res.json());

   // Количество положительных отзывов
   const positiveReviewsRequest = fetch(
      "https://www.bybit.com/x-api/fiat/otc/order/appraiseList",
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            makerUserId: userId,
            page: "1",
            size: "1", // достаточно 1, чтобы получить count
            appraiseType: "1",
         }),
      }
   ).then((res) => res.json());

   // Выполняем ВСЁ параллельно
   const [reviewsResults, hiddenResults, balanceJson, positiveJson] =
      await Promise.all([
         Promise.all(reviewRequests),
         Promise.all(hiddenReviewRequests),
         balanceRequest,
         positiveReviewsRequest,
      ]);

   // Объединяем обычные и скрытые отзывы
   const allReviews = [...reviewsResults, ...hiddenResults].flatMap(
      (json) => json.result?.appraiseInfoVo ?? []
   );

   // Уникализируем (лучше по id, а не по ссылке на объект)
   const uniqueReviews: Review[] = Array.from(
      new Map(allReviews.map((r: Review) => [r.id, r])).values()
   );

   // Сортировка по дате
   const negativeReviews = uniqueReviews.sort(
      (a, b) => Number(b.updateDate) - Number(a.updateDate)
   );

   return {
      negativeReviews,
      positiveReviewsCount: positiveJson.result?.count || 0,
      currentBalance: balanceJson.result[0]?.withdrawAmount || 0,
   };
}
// Создаем объект для хранения статистики в памяти
// Ключ в localStorage — при необходимости поменяйте (версионирование полезно при изменениях структуры)

export const reviewsStatistics = {
   data: (function loadFromStorage(): ReviewStats[] {
      try {
         const raw = localStorage.getItem("reviewsStatistics_v1");
         const parsed = raw ? JSON.parse(raw) : [];
         return parsed
      } catch (e) {
         console.warn(
            "Не удалось прочитать reviewsStatistics из GM-хранилища:",
            e
         );
         return [];
      }
   })(),

   _saveToStorage(): void {
      try {
         localStorage.setItem("reviewsStatistics_v1", JSON.stringify(this.data));
      } catch (e) {
         console.warn(
            "Не удалось сохранить reviewsStatistics в GM-хранилище:",
            e
         );
      }
   },

   add(stats: ReviewStats): void {
      const existingIndex = this.data.findIndex(
         (item) => item.userId === stats.userId
      );

      const newEntry: ReviewStats = { ...stats };

      if (existingIndex !== -1) {
         this.data[existingIndex] = newEntry;
      } else {
         this.data.push(newEntry);
      }

      this._saveToStorage();
   },

   getAll(): ReviewStats[] {
      return this.data.slice();
   },

   getLast(): ReviewStats | null {
      return this.data.length ? this.data[this.data.length - 1] : null;
   },

   clear(): void {
      this.data = [];
      this._saveToStorage();
   },

   getByUserId(userId: string): ReviewStats | null {
      return this.data.find((item) => item.userId === userId) || null;
   },
};

export default reviewsStatistics;

export async function loadAndDisplayReviews(originalAd: Ad) {
   const reviewsContainer = document.getElementById("reviews-container");
   console.log("reviewsContainer:", reviewsContainer);

   try {
      // --- 1. ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ДАННЫХ ---
      // Вызываем новую асинхронную функцию для загрузки отзывов
      const { negativeReviews, positiveReviewsCount, currentBalance } =
         await fetchReviewsData(originalAd.userId);

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
      const statsObject = {
         highlightedCount,
         goodReviewsCount: positiveReviewsCount,
         allReviewsLength: negativeReviews.length,
         userId: originalAd.userId,
      };

      // Добавляем объект в наш объект статистики
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


export async function processUserReviews(originalAd: Ad): Promise<void> {
    if(1){ //(!adShouldBeFiltered(originalAd)) {
      /*reviewsStatistics.getByUserId(originalAd.userId)===null*/ const {
         negativeReviews,
         positiveReviewsCount,
      } = await fetchReviewsData(originalAd.userId);
      console.log('negativereviewsCount:', negativeReviews.length);
      
      let highlightedCount = 0;

      negativeReviews.forEach((review) => {
         if (!review.appraiseContent) return;

         const analysis = analyzeReview(review.appraiseContent);

         if (analysis.shouldHighlight) {
            highlightedCount++;
         }
      });

      // --- СОХРАНЕНИЕ СТАТИСТИКИ ---
      const statsObject = {
         highlightedCount,
         goodReviewsCount: positiveReviewsCount,
         allReviewsLength: negativeReviews.length,
         userId: originalAd.userId,
      };
      console.log(originalAd.nickName);

      reviewsStatistics.add(statsObject);
   }
}
