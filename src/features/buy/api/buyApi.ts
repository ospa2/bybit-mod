import { createRowFromTemplate } from "../components/buyRow.ts";
import { adShouldBeFiltered } from "../../../shared/utils/adFilter.ts";
import { USER_ID } from "../../../core/config.ts";
import { appState } from "../../../core/state.ts";

import type { Ad, ApiResult, GenericApiResponse } from "../../../shared/types/ads";
import { watchOrder } from "../../../shared/orders/orderWatcher.ts";
import { StorageHelper } from "../../../shared/storage/storageHelper.ts";
import { findBestBuyAd } from "../automation/buyCardSelector.ts";
import { openBuyModal } from "../components/buyModal.ts";
import { updateMaxAmount } from "../../../shared/utils/bankParser.ts";


function now() {
   return new Date().toISOString();
}

export async function fetchAndAppendPage() {
   // Защита от одновременных вызовов
   if (appState.isLoading || appState.shouldStopLoading) return;
   appState.isLoading = true;

   try {
      const tbody = document.querySelector(".trade-table__tbody");
      if (!tbody) {
         console.log(`[${now()}] Tbody не найден — выходим.`);
         return;
      }

      // Если мы на sell-странице — просто один раз очистить таблицу и выйти
      // if (location.href.includes("/buy/USDT/RUB") || location.href.includes("/sell/USDT/RUB")) {
      //    tbody.querySelectorAll(".dynamic-row").forEach((row) => row.remove());
      //    tbody.querySelector(".completion-indicator")?.remove();
      //    return;
      // }

      // Если мы здесь — это buy страница
      if (!((location.href.includes("/buy/USDT/RUB") || location.href.includes("/sell/USDT/RUB")))) {
         console.log(`[${now()}] Не на buy/sell страницах — ничего не делаю.`);
         return;
      }

      // Параметры (size и side для buy)
      const payload = {
         userId: USER_ID,
         tokenId: "USDT",
         currencyId: "RUB",
         payment: [],
         side: "1", // buy
         size: "100",
         page: "1",
         amount: "",
         vaMaker: false,
         bulkMaker: false,
         canTrade: true,
         verificationFilter: 0,
         sortType: "OVERALL_RANKING",
         paymentPeriod: [],
         itemRegion: 1,
      };

      const res = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/item/online",
         {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
         }
      );

      const json = await res.json();
      const adsRaw: Ad[] = json.result.items || {};
      const ads: Ad[] = adsRaw.map((ad: Ad) => {
         ad = updateMaxAmount(ad)
         return ad
      })
      // Удаляем старые строки и индикатор
      tbody.querySelectorAll(".dynamic-row").forEach((row) => row.remove());
      tbody.querySelector(".completion-indicator")?.remove();

      // Создаем фрагмент и добавляем строки (приоритетные — наверх)
      const fragment = document.createDocumentFragment();

      const minPrice = Math.min(...ads.filter((ad: Ad) => !adShouldBeFiltered(ad)).map((a: Ad) => parseFloat(a.price)));
      localStorage.setItem("minPrice", minPrice.toString());
      if (ads) {
         try {
            const adAndCard = findBestBuyAd(ads);

            if (adAndCard) {
               openBuyModal(adAndCard, minPrice, true); // автоматическое создание ордера
            }
         } catch (error) {
            console.log('error:', error);

         }

         for (let i = 0; i < ads.length; i++) {

            try {
               const ad = ads[i];
               if (adShouldBeFiltered(ad) || parseFloat(ad.price) > minPrice*1.01) continue;
               const newRow = createRowFromTemplate(ad, minPrice)

               if (newRow) fragment.appendChild(newRow);
            } catch (error) {
               // !!! ЭТО ВЫЯВИТ ПРОБЛЕМУ !!!
               console.error(`Ошибка на итерации i=${i} для объявления:`, ads[i], error);
               // Продолжаем цикл, чтобы не прерывать весь процесс
               continue;
            }
         }
         // После этого цикл гарантированно завершится
         tbody.prepend(fragment); // Теперь этот код должен быть достигнут.

      } else {
         console.warn(`[${now()}] Ответ API не содержит ads.items массив.`);
      }


   } catch (e) {
      console.error(`[${now()}] Ошибка при подгрузке:`, e);
   } finally {
      appState.isLoading = false;
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