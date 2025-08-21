// src/api/bybitApi.js

/**
 * [НОВАЯ ФУНКЦИЯ] Загружает список объявлений с указанной страницы.
 * @param {number} page - Номер страницы для загрузки.
 * @returns {Promise<Array>} - Массив с объектами объявлений.
 */
export async function fetchAds(page) {
    const payload = {
        tokenId: "USDT",
        currencyId: "RUB",
        side: "0", // 0 для продажи (я покупаю), 1 для покупки (я продаю)
        size: "10",
        page: page.toString(),
        authMaker: false,
        canTrade: false
    };

    const response = await fetch("https://www.bybit.com/fiat/otc/item/online", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result?.items || []; // Возвращаем массив объявлений
}


/**
 * Получает детальную информацию об объявлении для модального окна.
 * @param {string} adId - ID объявления.
 * @returns {Promise<object>}
 */
export async function fetchAdDetails(adId) {
    const payload = { item_id: adId, shareCode: null };
    const response = await fetch("https://www.bybit.com/x-api/fiat/otc/item/simple", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to fetch ad details');
    return response.json();
}

/**
 * Получает отзывы по ID пользователя.
 * @param {string} userId - ID пользователя (мейкера).
 * @returns {Promise<Array>}
 */
export async function fetchReviews(userId) {
    let allReviews = [];
    for (let page = 1; page <= 7; page++) {
        const payload = { makerUserId: userId, page: page.toString(), size: "10", appraiseType: "0" };
        const response = await fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload)
        });
        const json = await response.json();
        const pageReviews = json.result?.appraiseInfoVo || json.data?.appraiseInfoVo || [];
        allReviews = allReviews.concat(pageReviews);
        if (pageReviews.length === 0) break;
    }
    return allReviews;
}

/**
 * Получает баланс пользователя.
 * @returns {Promise<string>}
 */
export async function fetchUserBalance() {
    const response = await fetch("https://www.bybit.com/x-api/fiat/otc/user/availableBalance", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId: "USDT" })
    });
    if (!response.ok) throw new Error('Failed to fetch balance');
    const json = await response.json();
    return json.result[0].withdrawAmount;
}

/**
 * Создает ордер на покупку/продажу.
 * @param {object} orderPayload - Тело запроса для создания ордера.
 * @returns {Promise<object>}
 */
export async function createOrder(orderPayload) {
     const response = await fetch('https://www.bybit.com/x-api/fiat/otc/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(orderPayload)
    });
    if (!response.ok) throw new Error('Failed to create order');
    return response.json();
}