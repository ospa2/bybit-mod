//import type { OriginalAd, Review } from './interfaces';
import './style.css';
import { forbiddenPhrases, stopPhrases, KEYWORDS_TO_HIGHLIGHT, KEYWORDS_TO_HIDE, MIN_EXECUTED_COUNT, MAX_PRICE_DIFFERENCE, USER_ID,  MAX_PAGES, DELAY_MS } from './config';
import { initSliderReplacement } from './rangeSlider';
import { disableBodyScroll, enableBodyScroll } from './lib';

let MIN_LEFT_VALUE = 9000;
let MAX_RIGHT_VALUE = 80000;

let currentPage = 0;
let isLoading = false;
let isSequentialLoadingActive = false; // Флаг для отслеживания активной загрузки
let shouldStopLoading = false; // Флаг для остановки текущей загрузки


function adShouldBeFiltered(ad) {
    // Проверка количества выполненных сделок
    if (parseInt(ad.finishNum) <= MIN_EXECUTED_COUNT) return true;

    // Проверка диапазона цен
    const min = parseFloat(ad.minAmount);
    const max = parseFloat(ad.maxAmount);
    const diff = max - min;

    if (isNaN(min) || isNaN(max)) return true;
    if (diff > MAX_PRICE_DIFFERENCE || max >= MAX_RIGHT_VALUE || min <= MIN_LEFT_VALUE) return true;

    // Проверка описания объявления на запрещенные фразы
    if (ad.remark && typeof ad.remark === 'string') {
        const remark = ad.remark.toLowerCase();
        
        

        // Проверяем наличие запрещенных фраз
        for (const phrase of forbiddenPhrases) {
            if (remark.includes(phrase)) {
                return true;
            }
        }
    }

    return false;
}

function filterRemark(description) {
    let filteredText = description;

    // 1. Оборачиваем каждую стоп-фразу в HTML-тег <strong>
    stopPhrases.forEach(phrase => {
        // Создаем регулярное выражение для поиска фразы без учета регистра и по всему тексту
        const regex = new RegExp(phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        // Заменяем найденную фразу на ту же фразу, обернутую в <strong>
        filteredText = filteredText.replace(regex, '');
    });

    // 2. Убираем лишние символы и эмодзи
    filteredText = filteredText.replace(/[✅📌❌🔒🎯—]/g, '');

    // 3. Очищаем текст от лишних пробелов, точек и переносов строк
    filteredText = filteredText
        .replace(/\s+/g, ' ')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\.{2,}/g, '.')
        .trim();

    return filteredText;
}

function createRowFromTemplate(ad) {
    const paymentNames = {
        '75': 'Тинькофф',//16627518
        '377': 'Сбербанк',//17762813
        '614': 'ПСБ',
        '382': 'SBP',//16627221
        '383': 'MIR',//19032627
        '616': 'Альфа-Банк',
        '617': 'Райффайзен',
        '581': 'Tinkoff',//17201839
        '582': 'Sberbank',//16664034
        '584': 'Sberbank',
        '585': 'Sberbank',//16664050
        '612': 'Уралсиб',
        '613': 'Уралсиб'
    };

    // Цвета для разных платежных методов
    const paymentColors = {
        '75': '#FFD700',   // Тинькофф - желтый
        '581': '#FFD700',  // Tinkoff - желтый
        '377': '#36d536ff',  // Сбербанк - зеленый
        '582': '#36d536ff',  // Sberbank - зеленый
        '585': '#36d536ff'   // Sberbank - зеленый
    };

    // Функция для получения цвета фона платежа
    function getPaymentStyle(paymentId) {
        const color = paymentColors[paymentId];
        return color ? `background-color: ${color}; color: white;` : '';
    }
    const filteredRemark = filterRemark(ad.remark);

    const rowHTML = `
            <div class="dynamic-row" style="display: contents;">
                <div class="table-row" style="display: table-row;">
                    <div class="table-cell" style="display: table-cell; width: 800px; padding: 16px; vertical-align: middle;">
                        <div class="moly-space flex items-center" style="gap: 16px;">
                            <div class="moly-space-item moly-space-item-first moly-space-item-last">
                                <div class="moly-space flex-col inline-flex moly-space-vertical items-start" style="gap: 0px;">
                                    <div class="moly-space-item moly-space-item-first">
                                        <div class="moly-space flex items-center" style="gap: 0px;">
                                            <div class="moly-space-item moly-space-item-first">
                                                <div class="by-avatar by-avatar--${ad.isOnline ? 'online' : 'offline'} small">
                                                    <div class="by-avatar__container">
                                                        <div class="by-avatar__container__letter">${ad.nickName ? ad.nickName.charAt(0).toUpperCase() : 'U'}</div>
                                                        <div class="by-avatar__container__status"></div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="moly-space-item">
                                                <div class="inline-block">
                                                    <div class="advertiser-name">
                                                        <span>${ad.nickName || 'Unknown'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="moly-space-item moly-space-item-last">
                                                <div class="inline-block">
                                                    ${ad.authTag && ad.authTag.length > 0 ? ad.authTag.map(tag => `<img src="/fiat/trade/gw/static/media/vaSilverIcon.8a83d2497a7eccc3612a.png" class="advertiser-auth-tag pointer">`).join('') : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="moly-space-item">
                                        <div class="advertiser-info">
                                            <span>${ad.finishNum || 0}&nbsp;исполнено</span>
                                            <span class="delimiter">|</span>
                                            <div class="inline-block">
                                                <span class="execute-rate">${ad.recentExecuteRate || 0}&nbsp;% | ${ad.paymentPeriod || 15} мин.</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="moly-space-item moly-space-item-last">
                                        <div class="moly-space flex items-baseline" style="gap: 16px;">
                                            <div class="moly-space-item moly-space-item-first" style="margin-top: 6px;">
                                                <div class="inline-block">
                                                    <span class="moly-text text-[var(--bds-gray-t2)] font-[400] inline pointer">
                                                        <img src="/fiat/trade/gw/static/media/clock.8fb8bc6c6fe17cf175ba8a0abda873f5.svg" alt="" width="14" style="vertical-align: -2px;">
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
                            ${parseFloat(ad.price).toFixed(2)} <span class="price-unit">${ad.currencyId || 'RUB'}</span>
                        </span>
                    </div>
                    <div class="table-cell" style="display: table-cell; min-width: 220px; padding: 16px; vertical-align: middle;">                     
                        <div class="ql-value">${parseFloat(ad.minAmount || 0).toLocaleString('ru-RU', {minimumFractionDigits: 2})}&nbsp;~&nbsp;${parseFloat(ad.maxAmount || 0).toLocaleString('ru-RU', {minimumFractionDigits: 2})} ${ad.currencyId || 'RUB'}</div>
                    </div>
                    <div class="table-cell" style="display: table-cell; width: 196px; padding: 16px; vertical-align: middle;">
                        ${ad.payments?.slice(0, 3).map(paymentId =>
                            `<div class="inline-block"><div class="trade-list-tag" style="${getPaymentStyle(paymentId)}">${paymentNames[paymentId] || paymentId}</div></div>`
                        ).join('') || '<div class="inline-block"><div class="trade-list-tag">Не указано</div></div>'}
                    </div>
                    <div class="table-cell trade-list-action-button" style="display: table-cell; padding: 16px; vertical-align: middle;">
                        <button class="moly-btn ${ad.side === 1 ? 'bg-greenColor-bds-green-700-normal' : 'bg-redColor-bds-red-700-normal'} text-base-bds-static-white px-[16px] py-[8px] rounded">
                            <span>${ad.side === 1 ? 'Купить' : 'Продать'} ${ad.tokenId || 'USDT'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rowHTML.trim();
    const newRow = tempDiv.firstChild;


    newRow.querySelector('button')?.addEventListener('click', async() => {
        const payload = {
            item_id: ad.id,
            shareCode: null
        }

        try {
            const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/simple", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            // Создаем и показываем модальное окно
            openTradingModal(result, ad, paymentNames);

        } catch (e) {
            console.error('Ошибка при подгрузке:', e);
        }
    });

    return newRow;
}

function analyzeReview(reviewText) {
    if (!reviewText) return { shouldHide: false, shouldHighlight: false };

    let shouldHide = false;
    let shouldHighlight = false;

    const searchText = reviewText.toLowerCase();

    // Проверяем каждое ключевое слово для скрытия (полное совпадение)
    KEYWORDS_TO_HIDE.forEach(keyword => {
        if (keyword.trim() === '') return;
        
        const searchKeyword = keyword.toLowerCase();
        
        if (searchText === searchKeyword) {
            shouldHide = true;
        }
    });

    // Проверяем на спам-отзывы с повторяющимися фразами
    const spamKeywords = ['медленный', 'грубый', 'просит оплатить дополнительные комиссии','нетерпеливый','slow','rude','asks for additional fees','impatient'];

    // Разбиваем текст на фрагменты по запятым и очищаем пробелы
    const textFragments = searchText.split(',').map(fragment => fragment.trim());

    // Проверяем, содержит ли отзыв только спам-ключевые слова
    let isSpamReview = textFragments.length > 0;
    for (let fragment of textFragments) {
        if (fragment === '') continue;
        
        let isSpamFragment = false;
        for (let spamKeyword of spamKeywords) {
            const searchSpamKeyword = spamKeyword.toLowerCase();
            if (fragment === searchSpamKeyword) {
                isSpamFragment = true;
                break;
            }
        }
        
        if (!isSpamFragment) {
            isSpamReview = false;
            break;
        }
    }

    // Дополнительно проверяем, что есть хотя бы 2 спам-ключевых слова
    let spamKeywordCount = 0;
    for (let fragment of textFragments) {
        if (fragment === '') continue;
        
        for (let spamKeyword of spamKeywords) {
            const searchSpamKeyword = spamKeyword.toLowerCase();
            if (fragment === searchSpamKeyword) {
                spamKeywordCount++;
                break;
            }
        }
    }

    if (isSpamReview && spamKeywordCount >= 2) {
        shouldHide = true;
    }

    // Проверяем ключевые слова для подсветки (частичное совпадение)
    KEYWORDS_TO_HIGHLIGHT.forEach(keyword => {
        if (keyword.trim() === '') return;
        
        const searchKeyword = keyword.toLowerCase();
        
        if (searchText.includes(searchKeyword)) {
            shouldHighlight = true;
        }
    });

    return { shouldHide, shouldHighlight };
}

// Функция для создания HTML отзыва с учетом фильтрации
function createReviewHTML(review, className) {
    function convertBybitTime(bybitTimestamp) {
        const date = new Date(bybitTimestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }
    // Предполагается, что у вас есть функция analyzeReview
    const analysis = analyzeReview(review.appraiseContent);
    const highlightClass = analysis.shouldHighlight ? 'highlighted-review' : '';
    const formattedDate = convertBybitTime(Number(review.updateDate)); // Конвертируем дату

    // Возвращаем HTML с датой и текстом отзыва
    return `
        <li class="${className} ${highlightClass}">           
            <p class="review-text">${formattedDate}: ${review.appraiseContent}</p>
        </li>
    `;
}

async function loadAndDisplayReviews(originalAd) {
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
                console.log('review:', review);
                
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

async function openTradingModal(apiResult, originalAd, paymentNames) {
    // Удаляем существующее модальное окно
    disableBodyScroll();
    const existingModal = document.querySelector('.bybit-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const adData = apiResult?.result || originalAd;

    // Создаем оверлей и модальное окно СРАЗУ
    const overlay = document.createElement('div');
    overlay.className = 'bybit-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'bybit-modal';

    // Вставляем "скелет" модального окна с плейсхолдерами для данных
    modal.innerHTML = `
        <div class="bybit-modal-header">
            <button class="bybit-modal-close" type="button">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.854 3.146a.5.5 0 0 1 0 .708l-9 9a.5.5 0 0 1-.708-.708l9-9a.5.5 0 0 1 .708 0z"/>
                    <path d="M3.146 3.146a.5.5 0 0 1 .708 0l9 9a.5.5 0 0 1-.708.708l-9-9a.5.5 0 0 1 0-.708z"/>
                </svg>
            </button>
        </div>
        <div class="bybit-modal-body">
            <div class="advertiser-panel">
                <div> 
                    <div class="advertiser-header">
                        <div class="avatar-container">
                            <div class="avatar ${originalAd.isOnline ? 'online' : ''}">
                                ${(originalAd.nickName || 'U').charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div class="advertiser-info">
                            <div class="advertiser-name">${originalAd.nickName || 'Unknown'}</div>
                            <div class="advertiser-stats">
                                <span>${originalAd.finishNum || 0} исполнено</span>
                                <span class="stats-divider">|</span>
                                <span>${originalAd.recentExecuteRate || 0}%</span>
                            </div>
                            <div class="online-status">${originalAd.isOnline ? 'Онлайн' : 'Офлайн'}</div>
                        </div>
                    </div>
                    <div class="verification-tags">
                        <div class="verification-tag">Эл. почта</div>
                        <div class="verification-tag">SMS</div>
                        <div class="verification-tag">Верификация личности</div>
                    </div>
                    <div class="crypto-info-section">
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Доступно</span>
                            <span class="crypto-info-value" id="balance-value">Загрузка...</span>
                        </div>
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Лимиты</span>
                            <span class="crypto-info-value">${parseFloat(adData.minAmount || 0).toLocaleString('ru-RU')} ~ ${parseFloat(adData.maxAmount || 0).toLocaleString('ru-RU')} ${adData.currencyId || 'RUB'}</span>
                        </div>
                        <div class="crypto-info-item">
                            <span class="crypto-info-label">Длительность оплаты</span>
                            <span class="crypto-info-value">${adData.paymentPeriod || 15} мин.</span>
                        </div>
                    </div>
                </div>
                <div class="terms-section">
                    <div class="terms-title">Отзывы о мейкере</div>
                    <div class="terms-content" id="reviews-container">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
            <div class="trading-panel">
                <div class="price-section">
                    <div class="price-header">
                        <span class="price-label">Цена</span>
                        <span class="price-timer" id="price-timer">29s</span>
                    </div>
                    <div class="price-value">${parseFloat(adData.price).toFixed(2)} ${adData.currencyId || 'RUB'}</div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я ${adData.side === 1 ? 'куплю' : 'продам'}</label>
                    <div class="input-container" id="amount-container">
                        <div class="input-wrapper">
                            <img class="coin-icon" src="data:image/svg+xml;base64,...">
                            <input type="text" class="amount-input" id="amount-input" placeholder="0.0000" autocomplete="off">
                            <div class="input-suffix">
                                <span>${adData.tokenId || 'USDT'}</span>
                                <span class="input-divider">|</span>
                                <button type="button" class="max-button" id="max-button">Все</button>
                            </div>
                        </div>
                    </div>
                    <div class="balance-info" id="available-for-trade">
                        // --- Этот текст тоже обновится после загрузки баланса ---
                        Доступно для ${adData.side === 1 ? 'покупки' : 'продажи'}: Загрузка...
                        <span class="info-icon">ℹ</span>
                    </div>
                </div>
                <div class="input-section">
                    <label class="input-label">Я получу</label>
                    <div class="input-container">
                        <div class="input-wrapper">
                            <div style="width: 24px; ...">₽</div>
                            <input type="text" class="amount-input" id="receive-input" placeholder="0.00" readonly>
                            <div class="input-suffix">
                                <span>${adData.currencyId || 'RUB'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="payment-section">
                    <label class="input-label">Способ оплаты</label>
                    <div class="payment-methods">
                        ${adData.payments && adData.payments.length > 0
                            ? adData.payments.map(paymentId => `<span class="payment-method">${paymentNames[paymentId] || paymentId}</span>`).join('')
                            : '<span class="payment-method">Не указано</span>'
                        }
                    </div>
                </div>
                <div class="button-section">
                    <button type="button" class="trade-button" id="trade-button">${adData.side === 1 ? 'Купить' : 'Продать'} ${adData.tokenId || 'USDT'}</button>
                    <button type="button" class="cancel-button" id="cancel-button">Отмена</button>
                </div>
            </div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    console.log('adData:', adData);
    console.log('originalAd:', originalAd);
    console.log('apiResult:', apiResult);
    
    
    // Настраиваем обработчики событий для уже существующих элементов
    setupHighQualityModalEvents(overlay, adData, originalAd, apiResult);
    startPriceTimer();

    // --- ЗАПУСКАЕМ АСИНХРОННУЮ ЗАГРУЗКУ ДАННЫХ ---
    loadAndDisplayReviews(originalAd);
    
    window.toggleTheme = toggleTheme;
}

// Функция настройки обработчиков событий (обновленная)
function setupHighQualityModalEvents(overlay, adData, originalAd, apiResult) {
    const amountInput = overlay.querySelector('#amount-input');
    const receiveInput = overlay.querySelector('#receive-input');
    const tradeButton = overlay.querySelector('#trade-button');
    const cancelButton = overlay.querySelector('#cancel-button');
    const maxButton = overlay.querySelector('#max-button');
    const closeButton = overlay.querySelector('.bybit-modal-close');
    // Функция валидации и активации кнопки
    function validateAndToggleButton() {
        const amount = parseFloat(amountInput.value) || 0;
        const minAmount = parseFloat(adData.minAmount) || 0;
        const maxAmount = parseFloat(adData.maxAmount) || 0;
        const balance = parseFloat(adData.availableBalance) || 0;

        const isValid = amount > 0 && 
                    amount >= minAmount && 
                    amount <= maxAmount && 
                    amount <= balance;

        tradeButton.disabled = !isValid;
        tradeButton.style.opacity = isValid ? '1' : '0.6';
        tradeButton.style.cursor = isValid ? 'pointer' : 'not-allowed';
    }

    // Функция расчета суммы к получению
    function calculateReceiveAmount() {
        const amount = parseFloat(amountInput.value) || 0;
        const price = parseFloat(adData.price) || 0;
        const receiveAmount = amount * price;
        receiveInput.value = receiveAmount.toFixed(2);
        validateAndToggleButton();
    }

    // === Покупка у продавца ===
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

    // === Продажа покупателю ===
    function createSellPayload(adData, originalAd, apiResult) {
        const paymentIdMap = {
            '75':  '16627518', // Тинькофф
            '377': '17762813', // Сбербанк
            '614': '',         // ПСБ
            '382': '16627221', // SBP
            '383': '19032627', // MIR
            '616': '',         // Альфа-Банк
            '617': '',         // Райффайзен
            '581': '17201839', // Tinkoff
            '582': '16664034', // Sberbank
            '584': '',         // Sberbank
            '585': '16664050', // Sberbank
            '612': '',         // Уралсиб
            '613': ''          // Уралсиб
        };

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
        
        // Обработка ввода суммы
        amountInput.addEventListener('input', calculateReceiveAmount);
        amountInput.addEventListener('keyup', calculateReceiveAmount);

        // Кнопка "Все"
        maxButton.addEventListener('click', () => {
            const maxAmount = Math.min(
                parseFloat(adData.maxAmount) || 0,
                parseFloat(adData.availableBalance) || 0
            );
            amountInput.value = maxAmount.toFixed(4);
            calculateReceiveAmount();
        });

        // НОВАЯ ЛОГИКА: Обработчик для кнопки торговли
        tradeButton.addEventListener('click', async () => {
            

            // Отключаем кнопку и показываем состояние загрузки
            tradeButton.disabled = true;
            const originalText = tradeButton.textContent;
            tradeButton.textContent = 'Отправка заявки...';
            tradeButton.style.opacity = '0.6';
            
            try {
                if (apiResult.ret_code == 912100027) {
                    showNotification("The ad status of your P2P order has been changed. Please try another ad.", "error");
                    closeModal()
                    throw new Error("The ad status of your P2P order has been changed. Please try another ad.");
                }
                if (apiResult.ret_code == 912300001) {
                    showNotification("Insufficient ad inventory, please try other ads.", "error");
                    closeModal()
                    throw new Error("Insufficient ad inventory, please try other ads.");
                }
                // Формируем payload для создания ордера
                const orderPayload = originalAd.side == 0 ? createSellPayload(adData, originalAd, apiResult) : createBuyPayload(adData, originalAd, apiResult);

                console.log('Отправка ордера:', orderPayload);

                // Отправляем POST запрос на создание ордера
                const response = await fetch('https://www.bybit.com/x-api/fiat/otc/order/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include', // Добавлено для куки авторизации
                    body: JSON.stringify(orderPayload)
                });

                const result = await response.json();
                console.log('Первый ответ:', result);                    

                // Проверяем, нужна ли верификация по риску
                if (response.ok && result.result && result.result.needSecurityRisk) {
                    let riskToken = result.result.securityRiskToken; // Используем let вместо const


                    // Получить код с клавиатуры (нужно реализовать ввод)
                    const code = prompt("Введите код аутентификтор:"); // Или другой способ получения кода
                    
                    if (!code) {
                        throw new Error("Код не введен");
                    }

                    // Отправляем verify
                    const verifyRes = await fetch("https://www.bybit.com/x-api/user/public/risk/verify", {
                        method: "POST",
                        headers: { 
                            "content-type": "application/json", 
                            "accept": "application/json" 
                        },
                        credentials: "include",
                        body: JSON.stringify({
                            risk_token: riskToken,
                            component_list: { 
                                google2fa: code // Убрал JSON.stringify, код должен быть строкой
                            }
                        })
                    });
                    
                    const verifyResult = await verifyRes.json();
                    console.log("Verify response:", verifyResult);

                    // Проверяем успешность верификации
                    if (verifyResult.ret_code === 0 && verifyResult.result) {
                        // Обновляем riskToken из результата верификации
                        riskToken = verifyResult.result.risk_token;
                        
                        // Добавляем riskToken в orderPayload
                        orderPayload.securityRiskToken = riskToken;
                        //google2fa
                        // Повторно создаём ордер с обновленным payload
                        const finalResponse = await fetch("https://www.bybit.com/x-api/fiat/otc/order/create", {
                            method: "POST",
                            headers: { 
                                "content-type": "application/json", 
                                "accept": "application/json" 
                            },
                            credentials: "include",
                            body: JSON.stringify(orderPayload)
                        });
                        
                        const finalResult = await finalResponse.json();
                        console.log("✅ Final create order:", finalResult);
                        
                        if (finalResult.ret_code === 0) {
                            console.log("🎉 Ордер на продажу успешно создан!");
                            showNotification('ордер успешно создан', 'success');
                            closeModal()
                            return finalResult;
                        } else {
                            console.error("❌ Ошибка при финальном создании ордера:", finalResult.ret_msg);
                            showNotification('The transaction limit has been exceeded', 'error');
                            throw new Error(`Order creation failed: ${finalResult.ret_msg}`);
                            
                        }
                    } else {
                        console.error("❌ Ошибка верификации:", verifyResult.ret_msg);
                        throw new Error(`Verification failed: ${verifyResult.ret_msg}`);
                    }
                    
                } else if (response.ok && result.ret_code === 0) {
                    // Ордер создан успешно без верификации
                    console.log("✅ Ордер на покупку создан успешно:", result);
                    showNotification('ордер успешно создан', 'success');
                    closeModal()
                    return result;
                    
                } else {
                    // Обработка других ошибок
                    showNotification(result.ret_msg || result, 'error');
                    closeModal()                       
                    throw new Error(`Order creation failed: ${result.ret_msg || 'Unknown error'}`);
                }

            } catch (error) {
                console.error('Ошибка при создании ордера:', error);
                throw error;
            }  finally {
                // Восстанавливаем состояние кнопки
                tradeButton.disabled = false;
                tradeButton.textContent = originalText;
                tradeButton.style.opacity = '1';
                validateAndToggleButton(); // Повторно валидируем
                }
                    });

        // Закрытие модального окна
        function closeModal() {
            overlay.remove();
            document.body.style.overflow = '';
            enableBodyScroll()
        }

        cancelButton.addEventListener('click', closeModal);
        closeButton.addEventListener('click', closeModal);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        });
}

// Функция для показа уведомлений
function showNotification(message, type = 'info') {
    // Удаляем существующие уведомления
    const existingNotifications = document.querySelectorAll('.trade-notification');
    existingNotifications.forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `trade-notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Функция таймера цены
function startPriceTimer() {
    const timerElement = document.querySelector('#price-timer');
    if (!timerElement) return;

    let seconds = 29;
    const interval = setInterval(() => {
        timerElement.textContent = `${seconds}s`;
        seconds--;

        if (seconds < 10) {
            timerElement.style.color = '#ff4757';
        }

        if (seconds < 0) {
            seconds = 29;
            timerElement.style.color = '#81858c';
            // Здесь можно добавить обновление цены
        }
    }, 1000);

    // Очищаем интервал при закрытии модального окна
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node.querySelector && node.querySelector('#price-timer')) {
                    clearInterval(interval);
                    observer.disconnect();
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}
function updateGlobalValues(min, max) {
    if(min == MIN_LEFT_VALUE && max == MAX_RIGHT_VALUE) return
    MIN_LEFT_VALUE = min;
    MAX_RIGHT_VALUE = max;
    handleUrlChange()
    console.log(`Значения обновлены: MIN_LEFT_VALUE = ${MIN_LEFT_VALUE}, MAX_RIGHT_VALUE = ${MAX_RIGHT_VALUE}`);
}

async function fetchAndAppendPage(pageNum) {
    if (isLoading || shouldStopLoading) return;
    isLoading = true;


    let side = "1";
    const currentUrl = window.location.href;
    if (currentUrl.includes("/sell/USDT/RUB")) side = "0";
    else if (currentUrl.includes("/buy/USDT/RUB")) side = "1";

    const payload = {
        userId: USER_ID,
        tokenId: "USDT",
        currencyId: "RUB",
        payment: [],
        side: side,
        size: "10",
        page: String(pageNum),
        amount: "",
        vaMaker: false,
        bulkMaker: false,
        canTrade: true,
        verificationFilter: 0,
        sortType: "OVERALL_RANKING",
        paymentPeriod: [],
        itemRegion: 1
    };

    try {
        const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/online", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        const ads = json.result || json.data || [];

        const tbody = document.querySelector('.trade-table__tbody');
        if (!tbody) return console.log('Tbody не найден');

        let addedCount = 0;

        ads.items.forEach(ad => {
            if (!adShouldBeFiltered(ad)) {
                const newRow = createRowFromTemplate(ad);
                if (newRow) {
                    tbody.appendChild(newRow);
                    addedCount++;
                }
            }
        });

    } catch (e) {
        console.error('Ошибка при подгрузке:', e);
    }

    isLoading = false;
}

async function loadAllPagesSequentially() {
    // Если уже идет загрузка, останавливаем её
    if (isSequentialLoadingActive) {
        shouldStopLoading = true;
        // Ждем завершения текущих операций
        while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log('Начинаю последовательную загрузку страниц...');
    
    isSequentialLoadingActive = true;
    shouldStopLoading = false;

    while (currentPage <= MAX_PAGES && !shouldStopLoading) {
        await fetchAndAppendPage(currentPage);
        
        // Проверяем, не нужно ли остановиться после каждой страницы
        if (shouldStopLoading) {
            break;
        }
        
        currentPage++;
        if (currentPage <= MAX_PAGES && !shouldStopLoading) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    isSequentialLoadingActive = false;
    
    if (!shouldStopLoading) {
        console.log('Все страницы загружены.');
    } else {
        console.log('Загрузка страниц остановлена из-за смены URL.');
    }
}

async function handleUrlChange() {
    const tbody = document.querySelector('.trade-table__tbody');
    if (!tbody) {
        return;
    }

    // Останавливаем текущую загрузку
    if (isSequentialLoadingActive) {
        shouldStopLoading = true;
        // Ждем завершения всех операций
        while (isSequentialLoadingActive || isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Очищаем таблицу
    tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
    tbody.querySelector('.completion-indicator')?.remove();

    // Сбрасываем состояние
    const currentUrl = window.location.href;
    if (currentUrl.includes("/sell/USDT/RUB")) {
        currentPage = 16
    } else  currentPage = 1;
    
    shouldStopLoading = false;
    
    // Запускаем новую загрузку
    loadAllPagesSequentially();
}

function observeUrlChanges() {
    let previousUrl = location.href;
    const observer = new MutationObserver(() => {
        if (location.href !== previousUrl) {
            console.log(`URL изменился: ${previousUrl} → ${location.href}`);
            previousUrl = location.href;
            handleUrlChange();
            setTimeout(() => {
                const tableRows = document.querySelectorAll('.trade-table__tbody tr');
                tableRows.forEach(row => {
                    row.classList.add('filtered-ad');
                });
            }, 2000);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function waitForTableAndStart() {
    const tbody = document.querySelector('.trade-table__tbody');
    
    if (!tbody || tbody.children.length === 0) {
        console.log('Ожидание таблицы с данными...');
        setTimeout(waitForTableAndStart, 500);
    } else {
        console.log('Таблица найдена. Запускаю подгрузку...');
        tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
        tbody.querySelector('.completion-indicator')?.remove();
        setTimeout(() => {
            const tableRows = document.querySelectorAll('.trade-table__tbody tr');
            
            tableRows.forEach(row => {
                row.classList.add('filtered-ad');
            })
            initSliderReplacement({
                min: MIN_LEFT_VALUE,
                max: MAX_RIGHT_VALUE,
                onUpdate: updateGlobalValues
            });
            loadAllPagesSequentially();
            observeUrlChanges();
            document.addEventListener('keydown', (event) => {
                // Проверяем, что нажата клавиша 'Z' (без учета регистра)
                if (event.key === 'z' || event.key === 'Z' || event.key === 'я' || event.key === 'Я') {
                    handleUrlChange();
                }
            });
        }, 100);
    }
}

setTimeout(waitForTableAndStart, 100);
console.log('Bybit P2P Filter Enhanced загружен');