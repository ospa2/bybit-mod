// src/components/TradingModal.js

import { disableBodyScroll, enableBodyScroll } from '../utils/domHelpers';
import { fetchUserBalance, fetchReviews, createOrder } from '../api/bybitApi';
import { analyzeReview } from '../logic/reviewAnalyzer';
import { createReviewHTML } from './Review'; // Предполагаем, что этот файл существует
import { paymentIdMap, paymentNames } from '../config';

let priceTimerInterval;

/**
 * Закрывает модальное окно и очищает ресурсы.
 */
function closeModal() {
    const overlay = document.querySelector('.bybit-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
    enableBodyScroll();
    clearInterval(priceTimerInterval);
}

/**
 * Запускает таймер обратного отсчета для обновления цены.
 */
function startPriceTimer() {
    let seconds = 29;
    const timerElement = document.getElementById('price-timer');
    if (!timerElement) return;

    priceTimerInterval = setInterval(() => {
        if (seconds <= 0) {
            clearInterval(priceTimerInterval);
            timerElement.textContent = 'Цена истекла';
            // Здесь можно добавить логику обновления цены
        } else {
            timerElement.textContent = `${seconds}s`;
            seconds--;
        }
    }, 1000);
}

/**
 * Обновляет UI-секцию с отзывами.
 * @param {Array} reviews - Массив объектов отзывов.
 */
function updateReviewsUI(reviews) {
    const reviewsContainer = document.getElementById('reviews-container');
    if (!reviewsContainer) return;

    if (!Array.isArray(reviews) || reviews.length === 0) {
        reviewsContainer.innerHTML = '<div class="no-reviews">Плохих отзывов нет</div>';
        return;
    }

    let reviewsHTML = '';
    let filteredCount = 0;
    let highlightedCount = 0;

    reviews.forEach(review => {
        if (!review.appraiseContent) return;

        const analysis = analyzeReview(review.appraiseContent);
        if (analysis.shouldHide) {
            filteredCount++;
            return;
        }
        if (analysis.shouldHighlight) {
            highlightedCount++;
        }
        // Предполагается, что createReviewHTML принимает объект отзыва и класс
        reviewsHTML += createReviewHTML(review, analysis.shouldHighlight ? 'highlighted' : '');
    });
    
    let infoHTML = '';
    if (filteredCount > 0 || highlightedCount > 0) {
        infoHTML = `
            <div class="filter-info">
                ${filteredCount > 0 ? `<span>Скрыто спам-отзывов: ${filteredCount}</span>` : ''}
                ${highlightedCount > 0 ? `<span>Подсвечено подозрительных: ${highlightedCount}</span>` : ''}
            </div>
        `;
    }

    if (reviewsHTML === '') {
         reviewsContainer.innerHTML = '<div class="no-reviews">Плохих отзывов нет</div>';
    } else {
        reviewsContainer.innerHTML = `${infoHTML}<ul class="reviews-list">${reviewsHTML}</ul>`;
    }
}

/**
 * Обновляет UI-секцию с балансом.
 * @param {string|number} balance - Доступный баланс пользователя.
 * @param {object} ad - Данные объявления.
 */
function updateBalanceUI(balance, ad) {
    const balanceElement = document.getElementById('balance-value');
    if (balanceElement) {
        balanceElement.textContent = `${parseFloat(balance || 0).toLocaleString('ru-RU', {minimumFractionDigits: 4})} ${ad.tokenId || 'USDT'}`;
    }

    const availableElement = document.getElementById('available-for-trade');
    if(availableElement) {
        availableElement.textContent = `Доступно для ${ad.side === 1 ? 'покупки' : 'продажи'}: ${parseFloat(balance || 0).toLocaleString('ru-RU', {minimumFractionDigits: 4})} ${ad.tokenId || 'USDT'}`;
    }
}

/**
 * Загружает асинхронно данные для модального окна (баланс, отзывы).
 * @param {object} originalAd - Исходные данные объявления.
 */
async function loadModalData(originalAd) {
    try {
        const [balance, reviews] = await Promise.all([
            fetchUserBalance(),
            fetchReviews(originalAd.userId)
        ]);

        updateBalanceUI(balance, originalAd);
        updateReviewsUI(reviews);

    } catch (e) {
        console.error('Ошибка при подгрузке данных для модального окна:', e);
        const reviewsContainer = document.getElementById('reviews-container');
        if (reviewsContainer) {
            reviewsContainer.innerHTML = '<div class="no-reviews error">Не удалось загрузить отзывы.</div>';
        }
    }
}

/**
 * Настраивает все обработчики событий для элементов модального окна.
 */
function setupModalEvents(overlay, apiResult, originalAd) {
    const adData = apiResult?.result || originalAd;
    
    const closeButton = overlay.querySelector('.bybit-modal-close');
    const cancelButton = overlay.querySelector('#cancel-button');
    const tradeButton = overlay.querySelector('#trade-button');
    const amountInput = overlay.querySelector('#amount-input');
    const receiveInput = overlay.querySelector('#receive-input');
    const maxButton = overlay.querySelector('#max-button');

    // Закрытие окна
    closeButton?.addEventListener('click', closeModal);
    cancelButton?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    // Логика расчета и валидации
    const validateAndToggleButton = () => {
        const amount = parseFloat(amountInput.value) || 0;
        // Данные для валидации берем из adData, так как они могут быть свежее
        const minAmount = parseFloat(adData.minAmount) || 0;
        const maxAmount = parseFloat(adData.maxAmount) || 0;
        const balance = parseFloat(adData.availableBalance) || 0; // Предполагается, что это поле есть

        const isValid = amount > 0 && amount * parseFloat(adData.price) >= minAmount && amount * parseFloat(adData.price) <= maxAmount && amount <= balance;
        
        tradeButton.disabled = !isValid;
        tradeButton.style.opacity = isValid ? '1' : '0.6';
    };

    const calculateReceiveAmount = () => {
        const amount = parseFloat(amountInput.value) || 0;
        const price = parseFloat(adData.price) || 0;
        receiveInput.value = (amount * price).toFixed(2);
        validateAndToggleButton();
    };

    amountInput?.addEventListener('input', calculateReceiveAmount);
    maxButton?.addEventListener('click', () => {
        // Логика кнопки "Все"
    });

    // Обработка клика по кнопке "Купить/Продать"
    tradeButton?.addEventListener('click', async () => {
        tradeButton.disabled = true;
        tradeButton.textContent = 'Отправка...';
        
        try {
            // Логика определения payload
            const orderPayload = adData.side === 0 
                ? createSellPayload(adData, originalAd, apiResult) 
                : createBuyPayload(adData, originalAd, apiResult);
            
            const result = await createOrder(orderPayload);

            if (result.ret_code === 0) {
                // Успех! Можно показать уведомление и закрыть окно.
                console.log('Ордер успешно создан:', result);
                closeModal();
            } else {
                // Обработка ошибки от API
                console.error('Ошибка создания ордера:', result.ret_msg);
                tradeButton.textContent = 'Ошибка!';
            }
        } catch (error) {
            console.error('Сетевая ошибка при создании ордера:', error);
            tradeButton.textContent = 'Ошибка!';
        }
    });
}

/**
 * Главная функция, которая создает и отображает модальное окно.
 * @param {object} apiResult - Результат запроса /item/simple.
 * @param {object} originalAd - Данные объявления из общего списка.
 */
export function openTradingModal(apiResult, originalAd) {
    closeModal(); // Закрываем предыдущее окно, если оно есть
    disableBodyScroll();

    const adData = apiResult?.result || originalAd;
    
    const overlay = document.createElement('div');
    overlay.className = 'bybit-modal-overlay';
    
    // HTML-скелет модального окна
    overlay.innerHTML = `
        <div class="bybit-modal">
            <div class="bybit-modal-header">
                <button class="bybit-modal-close" type="button">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.854 3.146a.5.5 0 0 1 0 .708l-9 9a.5.5 0 0 1-.708-.708l9-9a.5.5 0 0 1 .708 0z"/><path d="M3.146 3.146a.5.5 0 0 1 .708 0l9 9a.5.5 0 0 1-.708.708l-9-9a.5.5 0 0 1 0-.708z"/></svg>
                </button>
            </div>
            <div class="bybit-modal-body">
                <div class="advertiser-panel">
                    <div class="terms-section">
                        <div class="terms-title">Отзывы о мейкере</div>
                        <div class="terms-content" id="reviews-container"><div class="spinner"></div></div>
                    </div>
                </div>
                <div class="trading-panel">
                    <div class="price-section">
                        <span class="price-label">Цена</span>
                        <span class="price-timer" id="price-timer">29s</span>
                    </div>
                    <div class="price-value">${parseFloat(adData.price).toFixed(2)} ${adData.currencyId || 'RUB'}</div>
                    </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    startPriceTimer();
    setupModalEvents(overlay, apiResult, originalAd);
    loadModalData(originalAd);
}

// --- Вспомогательные функции для создания payload ---
function createBuyPayload(adData, originalAd, apiResult) {
    return {
        itemId: adData.id,
        tokenId: originalAd.tokenId,
        currencyId: originalAd.currencyId,
        side: "0",
        quantity: adData.minQuantity,
        amount: adData.minAmount,
        curPrice: apiResult.result.curPrice,
        flag: "amount",
        version: "1.0",
        securityRiskToken: "",
        isFromAi: false
    };
}


 function createSellPayload(adData, originalAd, apiResult) {
        // Приоритетные методы оплаты
        const priorityPayments = ['75', '377', '382'];
        
        // Ищем приоритетный метод оплаты в массиве adData.payments
        let selectedPayment = adData.payments[0]; // по умолчанию первый
        let selectedPaymentId = paymentIdMap[selectedPayment] || "";
        
        for (const payment of adData.payments) {
            if (priorityPayments.includes(payment)) {
                selectedPayment = payment;
                selectedPaymentId = paymentIdMap[payment] || "";
                break;
            }
        }

        return {
            itemId: adData.id,
            tokenId: originalAd.tokenId,
            currencyId: originalAd.currencyId,
            side: "1",
            quantity: adData.maxQuantity,
            amount: adData.maxAmount,
            curPrice: apiResult.result.curPrice,
            flag: "amount",
            version: "1.0",
            securityRiskToken: "",
            isFromAi: false,
            paymentType: selectedPayment,
            paymentId: selectedPaymentId,
            online: "0"
        };
    }