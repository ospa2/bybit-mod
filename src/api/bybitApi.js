import { createRowFromTemplate } from "../components/AdRow.js";
import { adShouldBeFiltered } from "../logic/adFilter.js";
import { USER_ID } from "../config.js";
import { appState } from "../state.js";

/**
 * Функция подгрузки следующей страницы объявлений.
 *  * Если страница уже загружается, то ничего не делает.
 *  * Определяет, является ли текущая страница страницей продажи или покупки USDT/RUB.
 *  * Собирает payload для запроса на сервер, где:
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
 *  * Отправляет POST запрос на https://www.bybit.com/x-api/fiat/otc/item/online
 *  * Если запрос успешен, то:
 * - Берет из ответа ads.items
 * - Если в ответе есть объявление с accountId="3453456436", оно будет первым в списке.
 * - Создает из них строки для таблицы
 * - Добавляет эти строки в начало tbody
 *  * Если запрос неудачен, то выводит ошибку в консоль.
 *  * В конце всегда выставляет appState.isLoading = false.
 */
const bestMerchants = [
    "149696147",//Love is….
    "350822297",//ZolotayaScaha
    "50115694",//Mansur S
    '123002421',//Super T
    "194018609",//FonDip
    '9916647',//Kings bit

];
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
        size = "150"
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
        if (payload.side==="1") {
            
        
        const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/online", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        const ads = json.result || json.data || {};

        const tbody = document.querySelector(".trade-table__tbody");
        if (!tbody) {
            console.log("Tbody не найден");
            return;
        }
        tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
        tbody.querySelector('.completion-indicator')?.remove();
        // 1. Создаем пустой фрагмент
        const fragment = document.createDocumentFragment();
        let prioritizedAds = []; // Переменная для хранения приоритетных объявлений
        
        // Убедимся, что ads.items существует и является массивом
        if (ads.items && Array.isArray(ads.items)) {
            ads.items.forEach(ad => {
                // Если это искомое объявление, сохраняем его и пропускаем добавление в фрагмент на этом шаге
                if (bestMerchants.includes(ad.userId)) {
                    prioritizedAds.push(ad);
                    return; // Переходим к следующему элементу массива
                }

                // Обрабатываем все остальные объявления как обычно
                if (!adShouldBeFiltered(ad)) {
                    const newRow = createRowFromTemplate(ad);
                    if (newRow) {
                        // 2. Добавляем обычные строки во фрагмент
                        fragment.appendChild(newRow);
                    }
                }
            });

            // Если приоритетное объявление было найдено, создаем для него строку
            // и добавляем ее в самое начало фрагмента
            if (prioritizedAds.length > 0) {
                prioritizedAds.forEach(ad => {
                    if (!adShouldBeFiltered(ad)) {
                        const prioritizedRow = createRowFromTemplate(ad);
                        if (prioritizedRow) {
                            fragment.prepend(prioritizedRow);
                        }
                    }
                })
            }
        }

        // 3. Добавляем весь фрагмент (со всеми строками) в начало tbody за один раз
        tbody.prepend(fragment);
    }
    } catch (e) {
        console.error("Ошибка при подгрузке:", e);
    } finally {
        // Гарантированно сбрасываем флаг загрузки в любом случае
        appState.isLoading = false;
    }
}