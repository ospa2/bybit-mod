import { createRowFromTemplate } from "../components/buyRow.ts";
import { adShouldBeFiltered } from "../../../shared/utils/adFilter.ts";
import { USER_ID } from "../../../core/config.ts";
import { appState } from "../../../core/state.ts";

import type { Ad, ApiResult, GenericApiResponse } from "../../../shared/types/ads";
import { watchOrder } from "../../../shared/orders/orderWatcher.ts";
import { StorageHelper } from "../../../shared/storage/storageHelper.ts";
import { findBestBuyAd, findBuyCard } from "../automation/buyAdSelector.ts";
import { openBuyModal } from "../components/buyModal.ts";
import { addPaymentsToAds, updateMaxAmount } from "../../../shared/utils/bankParser.ts";


function now() {
   return new Date().toISOString();
}

// Кэш для хранения ссылок на существующие строки таблицы
const rowCache = new Map<string, HTMLElement>();

export async function fetchAndAppendPage(): Promise<void> {
   if (appState.isLoading || appState.shouldStopLoading) return;

   const tbody = document.querySelector(".trade-table__tbody") as HTMLElement | null;
   if (!tbody) return;

   const isTargetPage = location.href.includes("/buy/USDT/RUB") || location.href.includes("/sell/USDT/RUB");
   if (!isTargetPage) return;

   appState.isLoading = true;

   try {
      const payload = {
         userId: USER_ID,
         tokenId: "USDT",
         currencyId: "RUB",
         payment: [],
         side: "1",
         size: "100",
         page: "1",
         sortType: "OVERALL_RANKING",
         itemRegion: 1,
         canTrade: true,
         vaMaker: false,
         bulkMaker: false,
         verificationFilter: 0,
         paymentPeriod: [],
      };

      const res = await fetch("https://www.bybit.com/x-api/fiat/otc/item/online", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
      });

      const json = await res.json();
      const adsRaw: Ad[] = json.result?.items ?? [];
      const adsRawWithBanks = addPaymentsToAds(adsRaw);
      const ads: Ad[] = adsRawWithBanks.map(updateMaxAmount).filter(ad => !adShouldBeFiltered(ad))


      // Расчет минимальной цены для фильтрации и логики
      const minPrice = ads.length > 0 ? Math.min(...ads.map(a => parseFloat(a.price))) : 0;
      localStorage.setItem("minPrice", minPrice.toString());

      // Автоматика (вызов модалки)
      const bestAd = findBestBuyAd(ads);
      if (bestAd) openBuyModal(bestAd, minPrice, true);

      const currentIterationIds = new Set<string>();

      // Проход по всем объявлениям из API
      for (const ad of ads) {
         const adId = ad.id;
         currentIterationIds.add(adId);

         // Если объявление не проходит фильтр — удаляем если было, или скипаем
         if (parseFloat(ad.price) > minPrice * 1.01) {
            removeRowFromDOM(adId);
            continue;
         }

         let row = rowCache.get(adId);

         if (row) {
            // ОБНОВЛЕНИЕ: Узел уже есть, меняем только текст
            updateRowData(row, ad, minPrice);
         } else {
            // СОЗДАНИЕ: Нового узла
            const newNode = createRowFromTemplate(ad, minPrice);
            if (newNode instanceof HTMLElement) {
               row = newNode;
               row.setAttribute("data-ad-id", adId);
               rowCache.set(adId, row);
            }
         }

         // Синхронизация порядка: appendChild переместит существующий узел в конец tbody
         // Это гарантирует, что порядок в DOM = порядку в массиве ads
         if (row) tbody.appendChild(row);
      }

      // Очистка: удаляем из DOM те ID, которых нет в новом ответе API
      for (const id of rowCache.keys()) {
         if (!currentIterationIds.has(id)) {
            removeRowFromDOM(id);
         }
      }

      tbody.querySelector(".completion-indicator")?.remove();

   } catch (e) {
      console.error(`[${now()}] Fetch Error:`, e);
   } finally {
      appState.isLoading = false;
   }
}

function removeRowFromDOM(id: string): void {
   const el = rowCache.get(id);
   if (el) {
      el.remove();
      rowCache.delete(id);
   }
}

/**
 * Точечное обновление данных внутри существующей строки
 */
function updateRowData(row: HTMLElement, ad: Ad, minPrice: number): void {
   // 1. Статус Online/Offline
   const avatar = row.querySelector('.by-avatar');
   if (avatar) {
      const newClass = `by-avatar by-avatar--${ad.isOnline ? "online" : "offline"} small`;
      if (avatar.className !== newClass) avatar.className = newClass;
   }

   // 2. Цена (основное число)
   const priceVal = row.querySelector('.js-price-value');
   if (priceVal) {
      const newPrice = parseFloat(ad.price ?? "0").toFixed(2);
      if (priceVal.textContent !== newPrice) priceVal.textContent = newPrice;
   }

   // 3. Лимиты (Min ~ Max)
   const qlValue = row.querySelector('.ql-value');
   if (qlValue) {
      const minStr = parseFloat(ad.minAmount ?? "0").toLocaleString("ru-RU", { minimumFractionDigits: 2 });
      const maxStr = parseFloat(ad.maxAmount ?? "0").toLocaleString("ru-RU", { minimumFractionDigits: 2 });
      const newHtml = `${minStr}&nbsp;~&nbsp;${maxStr} ${ad.currencyId ?? "RUB"}`;
      if (qlValue.innerHTML !== newHtml) qlValue.innerHTML = newHtml;
   }

   // 4. Кнопка и Карта
   const card = findBuyCard(ad, minPrice);
   const btn = row.querySelector('.moly-btn') as HTMLElement | null;
   const btnSpan = btn?.querySelector('span');
   if (btn && btnSpan) {
      const newText = card ? card.id : "нет карт";
      if (btnSpan.textContent !== newText) btnSpan.textContent = newText;

      const newBtnClass = `moly-btn ${card ? "bg-greenColor-bds-green-700-normal" : "bg-gray-500"} text-base-bds-static-white px-[16px] py-[8px] rounded`;
      if (btn.className !== newBtnClass) btn.className = newBtnClass;
   }
}

export function resumePendingOrders(): void {

   let orders: any = StorageHelper.getOrders();

   console.log(orders);

   for (const order of orders) {
      console.log(order.order.Status);

      if ((order.order.Status === "pending" || order.order.Status === "10" || order.order.Status === "20" || order.order.Status === "30" || order.order.Status === "40") && (!order.res || order.req)) {
         const card = order.card;
         if (card) {
            watchOrder(order.order["Order No."], card);
            console.log(
               `♻️ Возобновил отслеживание ордера ${order.order["Order No."]}`
            );
         }
      }
   }
}
export async function fetchAdDetails(ad: Ad): Promise<ApiResult & GenericApiResponse> {
   const payload = {
      item_id: ad.id,
      shareCode: null
   };

   try {
      const response: Response = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/item/simple", // Убедитесь, что константа URL определена или импортирована
         {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // credentials: 'include' важен для передачи куки сессии
            credentials: "include",
            body: JSON.stringify(payload),
         }
      );

      if (!response.ok) {
         // Ошибка сети или HTTP статус
         throw new Error(`Ошибка сети при запросе деталей объявления: ${response.status} ${response.statusText}`);
      }

      const apiRes: GenericApiResponse = await response.json();

      // Проверяем ret_code на уровне API ответа Bybit
      if (apiRes.ret_code !== 0) {
         // Возвращаем объект ошибки
         return apiRes as (ApiResult & GenericApiResponse);
      }

      // 1. Формируем предварительный объект результата
      // Мы приводим apiRes.result к any, чтобы безопасно прочитать remark, если его нет в типах
      const resultData = apiRes.result as any;

      const combinedResult = {
         ...apiRes.result,
         ret_code: apiRes.ret_code,
         ret_msg: apiRes.ret_msg,
         // Конвертируем side в строку, если в интерфейсе GenericApiResponse это string, а в Ad — number
         side: ad.side.toString(),
         nickName: ad.nickName,
         // ВАЖНО: Гарантируем наличие remark для функции парсинга. 
         // Приоритет: данные из детального ответа API -> данные из входного ad -> пустая строка
         remark: resultData.remark || ad.remark || ""
      } as unknown as (ApiResult & GenericApiResponse);

      // 2. Применяем логику обновления maxAmount и quantity
      // Функция updateMaxAmount вернет мутированный объект
      console.log(combinedResult.maxAmount);

      const updatedResult = updateMaxAmount(combinedResult);
      console.log(updatedResult.maxAmount)

      return updatedResult;

   } catch (error) {
      console.error("fetchAdDetails - Критическая ошибка:", error);
      // Возвращаем стандартизированный объект ошибки для обработки в логике
      return {
         ret_code: -1, // Неизвестная/критическая ошибка
         ret_msg: `Критическая ошибка загрузки: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
         result: null,
      } as unknown as (ApiResult & GenericApiResponse);
   }
}