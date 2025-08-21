import { analyzeReview } from '../logic/reviewAnalyzer.js';

export function createReviewHTML(review, className) {
    function convertBybitTime(bybitTimestamp) {
        const date = new Date(bybitTimestamp);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}.${m}.${y}`;
    }

    const analysis = analyzeReview(review.appraiseContent);
    const highlightClass = analysis.shouldHighlight ? 'highlighted-review' : '';
    const formattedDate = convertBybitTime(Number(review.updateDate));

    return `
        <li class="${className} ${highlightClass}">
            <p class="review-text">${formattedDate}: ${review.appraiseContent}</p>
        </li>
    `;
}

export async function loadAndDisplayReviews(originalAd) {
    try {
        // --- 1. ЗАГРУЗКА БАЛАНСА И ОТЗЫВОВ (код без изменений) ---
        let termsContent = [];
        let curBalance = 0;

        const balancePromise = fetch("https://www.bybit.com/x-api/fiat/otc/user/availableBalance", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId: "USDT" })
        }).then(res => res.json());

        const reviewsPromise = (async () => {
            let allReviews = [];
            for (let page = 1; page <= 7; page++) {
                const payload = { makerUserId: originalAd.userId, page: page.toString(), size: "10", appraiseType: "0" };
                const res = await fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                console.log('json:', json);
                
                const pageReviews = json.result?.appraiseInfoVo || json.data?.appraiseInfoVo || [];
                allReviews = allReviews.concat(pageReviews);
                if (pageReviews.length <= 0) break;
            }
            return allReviews;
        })();

        const [moneyJson, allNegReviews] = await Promise.all([balancePromise, reviewsPromise]);
        
        curBalance = moneyJson.result[0].withdrawAmount;
        termsContent = allNegReviews; // Это массив объектов отзывов

        // --- 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА (обновлен блок формирования отзывов) ---

        // Обновляем баланс (код без изменений)
        const balanceElement = document.getElementById('balance-value');
        if (balanceElement) {
            balanceElement.textContent = `${parseFloat(curBalance || 0).toLocaleString('ru-RU', {minimumFractionDigits: 4, maximumFractionDigits: 4})} ${originalAd.tokenId || 'USDT'}`;
        }
        
        const availableBalanceElement = document.getElementById('available-for-trade');
        if(availableBalanceElement) {
            availableBalanceElement.textContent = `Доступно для ${originalAd.side === 1 ? 'покупки' : 'продажи'}: ${parseFloat(curBalance || 0).toLocaleString('ru-RU', {minimumFractionDigits: 4})} ${originalAd.tokenId || 'USDT'}`;
        }

        // --- БЛОК ФОРМИРОВАНИЯ HTML ДЛЯ ОТЗЫВОВ (здесь основные изменения) ---
        let reviewsHTML = '';
        let filteredCount = 0;
        let highlightedCount = 0;

        if (Array.isArray(termsContent) && termsContent.length > 0) {
            
            // <-- ИЗМЕНЕНИЕ: Мы теперь итерируем по всему массиву объектов, а не только по текстам.
            termsContent.forEach(review => {
                if (!review.appraiseContent) return; // Проверяем наличие текста отзыва
                
                const analysis = analyzeReview(review.appraiseContent);
                if (analysis.shouldHide) {
                    filteredCount++;
                    return;
                }
                if (analysis.shouldHighlight) {
                    highlightedCount++;
                }
                
                // <-- ИЗМЕНЕНИЕ: Вызываем новую функцию, передавая ей ВЕСЬ объект отзыва.
                reviewsHTML += createReviewHTML(review, 'review-item');
            });

            if (filteredCount > 0 || highlightedCount > 0) {
                reviewsHTML = `
                    <div class="filter-info">
                        ${filteredCount > 0 ? `<span class="filtered-info">Скрыто спам-отзывов: ${filteredCount}</span>` : ''}
                        ${highlightedCount > 0 ? `<span class="highlighted-info">Подсвечено подозрительных: ${highlightedCount}</span>` : ''}
                    </div>
                    ${reviewsHTML}
                `;
            }
            reviewsHTML = `<ul class="reviews-list">${reviewsHTML}</ul>`;
            
            // <-- ИЗМЕНЕНИЕ: Сравниваем с общей длиной исходного массива.
            if (filteredCount === termsContent.length) reviewsHTML = '<div class="no-reviews">Плохих отзывов нет</div>';
        } else {
            reviewsHTML = '<div class="no-reviews">Плохих отзывов нет</div>';
        }

        const reviewsContainer = document.getElementById('reviews-container');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = reviewsHTML;
        }

    } catch (e) {
        console.error('Ошибка при подгрузке данных для модального окна:', e);
        const reviewsContainer = document.getElementById('reviews-container');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = '<div class="no-reviews error">Не удалось загрузить отзывы.</div>';
        }
    }
}
