import { analyzeReview } from '../logic/reviewAnalyzer.ts';
import { GM_getValue, GM_setValue } from "$";
import type { Review, ReviewStats } from '../types/reviews';
import type { Ad } from '../types/ads';
function createReviewHTML(review: Review, className: string) {
    function convertBybitTime(bybitTimestamp: string) {
        const bbtt = Number(bybitTimestamp)
        const date = new Date(bbtt);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        
        return `${d}.${m}.${y}`;
    }

    const analysis = analyzeReview(review.appraiseContent);
    const highlightClass = analysis.shouldHighlight ? 'highlighted-review' : '';
    const formattedDate = convertBybitTime(review.updateDate);

    return `
        <li class="${className} ${highlightClass}">
            <p class="review-text">${formattedDate}: ${review.appraiseContent}</p>
        </li>
    `;
}

// --- Вспомогательная функция для загрузки всех страниц отзывов ПАРАЛЛЕЛЬНО ---
async function fetchAllReviews(userId: string) {
    // Создаем массив номеров страниц [1, 2, 3, 4, 5, 6, 7]
    const pageNumbers = Array.from({ length: 7 }, (_, i) => i + 1);

    // Создаем массив промисов, где каждый элемент - это fetch-запрос за одной страницей
    const reviewPromises = pageNumbers.map(page => {
        const payload = { makerUserId: userId, page: page.toString(), size: "10", appraiseType: "0" };
        return fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => res.json());
    });
    const hiddenReviewPromises = pageNumbers.map(page => {
        const payload = { makerUserId: userId, page: page.toString(), size: "10", appraiseType: "0", foldingDisplay: "1" };
        return fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => res.json());
    })
    // Ожидаем выполнения ВСЕХ запросов одновременно
    const allPromises = [...reviewPromises, ...hiddenReviewPromises];
    const results = await Promise.all(allPromises);
    const hiddenResults = await Promise.all(hiddenReviewPromises);
    // Собираем отзывы из всех полученных страниц в один плоский массив
    // и сразу отсекаем пустые страницы
    const reviews = results.flatMap(json => 
        json.result?.appraiseInfoVo || []
    );
    
    

    const hiddenReviews = hiddenResults.flatMap(json => 
        json.result?.appraiseInfoVo || []
    );
    const allReviews = reviews.concat(hiddenReviews);
    const uniqueReviews = allReviews.filter((item, index) => allReviews.indexOf(item) === index);
    const sortedReviews = uniqueReviews.sort((a, b) => b.updateDate - a.updateDate);
    
    return sortedReviews;
}


// Создаем объект для хранения статистики в памяти
// Создаем объект для хранения статистики в памяти
// Ключ в localStorage — при необходимости поменяйте (версионирование полезно при изменениях структуры)
const STORAGE_KEY = "reviewsStatistics_v1";

const reviewsStatistics = {
  data: (function loadFromStorage(): ReviewStats[] {
    try {
      const parsed = GM_getValue(STORAGE_KEY, []) as unknown;
      return Array.isArray(parsed) ? (parsed as ReviewStats[]) : [];
    } catch (e) {
      console.warn("Не удалось прочитать reviewsStatistics из GM-хранилища:", e);
      return [];
    }
  })(),

  _saveToStorage(): void {
    try {
      GM_setValue(STORAGE_KEY, this.data);
    } catch (e) {
      console.warn("Не удалось сохранить reviewsStatistics в GM-хранилище:", e);
    }
  },

  add(stats: ReviewStats): void {
    const existingIndex = this.data.findIndex((item) => item.userId === stats.userId);

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
    const reviewsContainer = document.getElementById('reviews-container');
    try {
        // --- 1. ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ДАННЫХ ---
        
        const balancePromise = fetch("https://www.bybit.com/x-api/fiat/otc/user/availableBalance", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId: "USDT" })
        }).then(res => res.json());

        const goodReviewsCountPromise = fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ makerUserId: originalAd.userId, page: "1", size: "10", appraiseType: "1", })
        }).then(res => res.json());
        
        // Вызываем новую асинхронную функцию для загрузки отзывов
        const reviewsPromise = fetchAllReviews(originalAd.userId);

        // Ожидаем оба промиса, как и раньше
        const [goodReviewsCount, balanceResponse, allReviews] = await Promise.all([goodReviewsCountPromise, balancePromise, reviewsPromise]);
        
        console.log('goodReviewsCount:', goodReviewsCount.result.count);
        // Используем деструктуризацию для чистоты
        const { result: [{ withdrawAmount: curBalance = 0 }] = [] } = balanceResponse;
        
        const balanceValueEl = document.getElementById('balance-value');
        const availableForTradeEl = document.getElementById('available-for-trade');
        
        // Исправлено: Используем конкатенацию или метод .toString() для преобразования числа в строку
        if (balanceValueEl) {
            balanceValueEl.textContent = (balanceResponse.result[0]?.withdrawAmount || 0).toString() + " USDT";
        }
            
        if (availableForTradeEl) {
            availableForTradeEl.textContent = `Доступно для ${originalAd.side === 1 ? 'покупки' : 'продажи'}: ${(balanceResponse.result[0]?.withdrawAmount || 0).toString()} ${originalAd.tokenId || 'USDT'}`;
        }
        
        // --- 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ---

        // Обновляем баланс (код без изменений)
        const balanceElement = document.getElementById('balance-value');
        if (balanceElement) {
            balanceElement.textContent = `${parseFloat(curBalance).toLocaleString('ru-RU', {minimumFractionDigits: 4, maximumFractionDigits: 4})} ${originalAd.tokenId || 'USDT'}`;
        }
        const titleElement = document.getElementById('reviews-titleee');
       
        if (titleElement) {
            titleElement.textContent = `Хороших отзывов: ${goodReviewsCount.result.count}`;
        }
        
        const availableBalanceElement = document.getElementById('available-for-trade');
        if(availableBalanceElement) {
            availableBalanceElement.textContent = `Доступно для ${originalAd.side === 1 ? 'покупки' : 'продажи'}: ${parseFloat(curBalance).toLocaleString('ru-RU', {minimumFractionDigits: 4})} ${originalAd.tokenId || 'USDT'}`;
        }

        // --- БЛОК ФОРМИРОВАНИЯ HTML (рефакторинг с использованием map) ---
        let reviewsHTML = '<div class="no-reviews">Плохих отзывов нет</div>';
        let highlightedCount = 0;

        if (Array.isArray(allReviews) && allReviews.length > 0) {
            let filteredCount = 0;

            const reviewItemsHTML = allReviews
                .map(review => {
                    if (!review.appraiseContent) return ''; // Пропускаем отзывы без текста

                    const analysis = analyzeReview(review.appraiseContent);
                    if (analysis.shouldHide) {
                        filteredCount++;
                        return ''; // Возвращаем пустую строку для скрываемых отзывов
                    }
                    if (analysis.shouldHighlight) {
                        highlightedCount++;
                    }
                    
                    return createReviewHTML(review, 'review-item'); // Ваша функция генерации HTML для одного отзыва
                })
                .join(''); // Объединяем весь массив HTML-строк в одну

            if (reviewItemsHTML.trim()) { // Если после фильтрации остались отзывы
                const statsHTML = (filteredCount > 0 || highlightedCount > 0) ? `
                    <div class="filter-info">                    
                        ${filteredCount > 0 ? `<span class="filtered-info">Скрыто спам-отзывов: ${filteredCount}</span>` : ''}
                        ${highlightedCount > 0 ? `<span class="highlighted-info">Подсвечено подозрительных: ${highlightedCount}</span>` : ''}
                    </div>
                ` : '';
                
                reviewsHTML = `${statsHTML}<ul class="reviews-list">${reviewItemsHTML}</ul>`;
            }
        }

        // --- СОХРАНЕНИЕ СТАТИСТИКИ ---
        const statsObject = {
            highlightedCount,
            goodReviewsCount: goodReviewsCount.result.count,
            allReviewsLength: allReviews.length,
            userId: originalAd.userId
        };
        
        // Добавляем объект в наш объект статистики
        reviewsStatistics.add(statsObject);
        

        if (reviewsContainer) {
            reviewsContainer.innerHTML = reviewsHTML;
        }

    } catch (e) {
        console.error('Ошибка при подгрузке данных для модального окна:', e);
        if (reviewsContainer) {
            reviewsContainer.innerHTML = '<div class="no-reviews error">Не удалось загрузить отзывы.</div>';
        }
    }
}