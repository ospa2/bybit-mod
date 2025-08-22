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

// --- Вспомогательная функция для загрузки всех страниц отзывов ПАРАЛЛЕЛЬНО ---
async function fetchAllReviews(userId) {
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
    const results = await Promise.all(reviewPromises, hiddenReviewPromises);
    const hiddenResults = await Promise.all(hiddenReviewPromises)
    // Собираем отзывы из всех полученных страниц в один плоский массив
    // и сразу отсекаем пустые страницы
    const reviews = results.flatMap(json => 
        json.result?.appraiseInfoVo || []
    );

    const hiddenReviews = hiddenResults.flatMap(json => 
        json.result?.appraiseInfoVo || []
    );
    const allReviews = reviews.concat(hiddenReviews);
    const sortedReviews = allReviews.sort((a, b) => b.updateDate - a.updateDate);
    
    return sortedReviews;
}


export async function loadAndDisplayReviews(originalAd, setBalance) {
    const reviewsContainer = document.getElementById('reviews-container');
    
    try {
        // --- 1. ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ДАННЫХ ---
        
        const balancePromise = fetch("https://www.bybit.com/x-api/fiat/otc/user/availableBalance", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tokenId: "USDT" })
        }).then(res => res.json());

        // Вызываем новую асинхронную функцию для загрузки отзывов
        const reviewsPromise = fetchAllReviews(originalAd.userId);

        // Ожидаем оба промиса, как и раньше
        const [balanceResponse, allReviews] = await Promise.all([balancePromise, reviewsPromise]);
        
        // Используем деструктуризацию для чистоты
        const { result: [{ withdrawAmount: curBalance = 0 }] = [] } = balanceResponse;
        
        setBalance(balanceResponse.result[0]?.withdrawAmount || 0);

        // --- 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ---

        // Обновляем баланс (код без изменений)
        const balanceElement = document.getElementById('balance-value');
        if (balanceElement) {
            balanceElement.textContent = `${parseFloat(curBalance).toLocaleString('ru-RU', {minimumFractionDigits: 4, maximumFractionDigits: 4})} ${originalAd.tokenId || 'USDT'}`;
        }
        
        const availableBalanceElement = document.getElementById('available-for-trade');
        if(availableBalanceElement) {
            availableBalanceElement.textContent = `Доступно для ${originalAd.side === 1 ? 'покупки' : 'продажи'}: ${parseFloat(curBalance).toLocaleString('ru-RU', {minimumFractionDigits: 4})} ${originalAd.tokenId || 'USDT'}`;
        }

        // --- БЛОК ФОРМИРОВАНИЯ HTML (рефакторинг с использованием map) ---
        let reviewsHTML = '<div class="no-reviews">Плохих отзывов нет</div>';

        if (Array.isArray(allReviews) && allReviews.length > 0) {
            let filteredCount = 0;
            let highlightedCount = 0;

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