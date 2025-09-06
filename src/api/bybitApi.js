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
function now() { return new Date().toISOString(); }

export async function fetchAndAppendPage() {
  // Защита от одновременных вызовов
  if (appState.isLoading || appState.shouldStopLoading) return;
  appState.isLoading = true;

  try {
    const currentUrl = window.location.href;
    const tbody = document.querySelector(".trade-table__tbody");
    if (!tbody) {
      console.log(`[${now()}] Tbody не найден — выходим.`);
      return;
    }

    // Если мы на sell-странице — просто один раз очистить таблицу и выйти
    if (currentUrl.includes("/sell/USDT/RUB")) {
      console.log(`[${now()}] sell — очищаю таблицу и не делаю fetch.`);
      tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
      tbody.querySelector('.completion-indicator')?.remove();
      return;
    }

    // Если мы здесь — это buy страница
    if (!currentUrl.includes("/buy/USDT/RUB")) {
      console.log(`[${now()}] Не на buy/sell страницах — ничего не делаю.`);
      return;
    }

    console.log(`[${now()}] buy — выполняю запрос к API.`);

    // Параметры (size и side для buy)
    const payload = {
      userId: USER_ID,
      tokenId: "USDT",
      currencyId: "RUB",
      payment: [],
      side: "1",      // buy
      size: "150",
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

    const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/online", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    const ads = json.result || json.data || {};

    // Удаляем старые строки и индикатор
    tbody.querySelectorAll('.dynamic-row').forEach(row => row.remove());
    tbody.querySelector('.completion-indicator')?.remove();

    // Создаем фрагмент и добавляем строки (приоритетные — наверх)
    const fragment = document.createDocumentFragment();
    const prioritizedAds = [];

    if (ads.items && Array.isArray(ads.items)) {
      for (const ad of ads.items) {
        if (typeof bestMerchants !== 'undefined' && bestMerchants.includes && bestMerchants.includes(ad.userId)) {
          prioritizedAds.push(ad);
          continue;
        }

        if (typeof adShouldBeFiltered === 'function' && adShouldBeFiltered(ad)) {
          continue;
        }

        const newRow = typeof createRowFromTemplate === 'function' ? createRowFromTemplate(ad) : null;
        if (newRow) fragment.appendChild(newRow);
      }

      // Добавляем приоритетные объявления в начало
      if (prioritizedAds.length) {
        for (const ad of prioritizedAds.reverse()) { // reverse чтобы сохранить порядок при prepend
          if (typeof adShouldBeFiltered === 'function' && adShouldBeFiltered(ad)) continue;
          const prRow = typeof createRowFromTemplate === 'function' ? createRowFromTemplate(ad) : null;
          if (prRow) fragment.prepend(prRow);
        }
      }
    } else {
      console.warn(`[${now()}] Ответ API не содержит ads.items массив.`);
    }

    // Вставляем в tbody
    tbody.prepend(fragment);
    console.log(`[${now()}] Вставил ${fragment.childNodes.length} строк(ы) в tbody.`);
  } catch (e) {
    console.error(`[${now()}] Ошибка при подгрузке:`, e);
  } finally {
    appState.isLoading = false;
  }
}