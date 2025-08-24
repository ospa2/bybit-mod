import { createRowFromTemplate } from "../components/AdRow.js";
import { adShouldBeFiltered } from "../logic/adFilter.js";
import { USER_ID } from "../config.js";
import { appState } from "../state.js";

/**
 * Функция подгрузки следующей страницы объявлений.
 * 
 * Если страница уже загружается, то ничего не делает.
 * 
 * Определяет, является ли текущая страница страницей продажи или покупки USDT/RUB.
 * 
 * Собирает payload для запроса на сервер, где:
 * - userId = USER_ID
 * - tokenId = "USDT"
 * - currencyId = "RUB"
 * - payment = [] (пустой массив)
 * - side = 0 (для продажи) или 1 (для покупки)
 * - size = 1 для покупки или 300 для продажи
 * - page = 1
 * - amount = ""
 * - vaMaker = false
 * - bulkMaker = false
 * - canTrade = true
 * - verificationFilter = 0
 * - sortType = "OVERALL_RANKING"
 * - paymentPeriod = []
 * - itemRegion = 1
 * 
 * Отправляет POST запрос на https://www.bybit.com/x-api/fiat/otc/item/online
 * 
 * Если запрос успешен, то:
 * - Берет из ответа ads.items
 * - Создает из них строки для таблицы
 * - Добавляет эти строки в начало tbody
 * 
 * Если запрос неудачен, то выводит ошибку в консоль.
 * 
 * В конце всегда выставляет appState.isLoading = false.
 */
export async function fetchAndAppendPage() { 
    if (appState.isLoading || appState.shouldStopLoading) return; 
    appState.isLoading = true; 
 
    let side = "1";
    let size = "1"
    const currentUrl = window.location.href; 
    if (currentUrl.includes("/sell/USDT/RUB")) {
        side = "0"
        size = "300"
    }
    else if (currentUrl.includes("/buy/USDT/RUB")) {
        side = "1"
        size = "70"
    }; 
 
    const payload = { 
        userId: USER_ID, 
        tokenId: "USDT", 
        currencyId: "RUB", 
        payment: [], 
        side: side, 
        size: size, 
        page: "1", 
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
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(payload) 
        }); 
 
        const json = await res.json(); 
        const ads = json.result || json.data || []; 
 
        const tbody = document.querySelector(".trade-table__tbody"); 
        if (!tbody) { 
            console.log("Tbody не найден"); 
            return; 
        } 
    
        // 1. Создаем пустой фрагмент
        const fragment = document.createDocumentFragment();

        ads.items.forEach(ad => {
            // Создаем newRow
            if (!adShouldBeFiltered(ad)) {
                const newRow = createRowFromTemplate(ad);
                if (newRow) { 
                    // 2. Добавляем строки во фрагмент в правильном порядке
                    fragment.appendChild(newRow); 
                }
           }
        });

        // 3. Добавляем весь фрагмент (со всеми строками) в начало tbody за один раз
        tbody.prepend(fragment);

    } catch (e) { 
        console.error("Ошибка при подгрузке:", e); 
    } 
 
    appState.isLoading = false; 
} 
