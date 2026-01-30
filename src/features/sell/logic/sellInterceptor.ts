// src/features/sell/api/sellInterceptor.ts
import { enhanceAdRows } from "./sellAdProc";
import type { Ad } from "../../../shared/types/ads";


import { saveSellData } from "../api/sellApi";
import { backgroundProcessAds } from "../../reviews/logic/reviewsSync";
import { setupSellButtonListener } from "../components/sellDOMHandlers";
import { checkTelegramResponse } from "../api/telegramNotifier";
import { AutoClickElements } from "../automation/autoсlicker";

let onlineAdsData: Ad[] = []; // Локальное хранилище данных об объявлениях на продажу


// ==== Восстановление при загрузке страницы ====

export function initFetchInterceptor() {
   // Этот код перехватывает XHR, а не fetch.

   function watchCurAds() {

      let lastValue = localStorage.getItem("curAds");

      setInterval(async () => {
         const newValue = localStorage.getItem("curAds");//текущие уже отфильтрованные объявления на продажу(около 20 штук обычно)

         if (newValue !== lastValue && newValue && window.location.href.includes("sell")) {
            lastValue = newValue;

            try {
               const body = JSON.parse(newValue);

               onlineAdsData = body || [];

               enhanceAdRows(onlineAdsData);

               setupSellButtonListener(onlineAdsData);

               backgroundProcessAds();

            } catch (err) {
               console.error("Ошибка при обработке unknownUserIds:", err);
            }
         }
      }, 1000); // проверка раз в секунду
   }

   watchCurAds();
   // const originalFetch = window.fetch;


   async function runBotPolling() {
      while (true) {
         try {
            // Запрос будет "висеть" до 30 сек, если событий нет.
            // Как только вы нажмете кнопку, TG мгновенно вернет ответ.
            await checkTelegramResponse();
         } catch (error) {
            console.error("Polling error, retry in 5s", error);
            await new Promise(resolve => setTimeout(resolve, 5000));
         }
      }
   }
   setInterval(() => {
      if (window.location.href === "https://www.bybit.com/ru-RU/p2p/sell/USDT/RUB") {
         AutoClickElements.findAndClickRefreshSelector((window as any).autoClicker)
      }
   }, 1000 * 60);


   // Запуск бота
   runBotPolling();

   // не сработает, если создать ордер с телефона
   function watchCurOrders() {
      let isProcessing = false; // защита от повторного выполнения
      const interval = 1000; // интервал проверки

      setInterval(async () => {
         if (isProcessing) return;
         isProcessing = true;

         try {
            const newValue = localStorage.getItem("!orders");
            if (!newValue) {
               isProcessing = false;
               return;
            }

            let curOrders = [];
            try {
               curOrders = JSON.parse(newValue);
            } catch (jsonErr) {
               console.error("Ошибка парсинга !orders:", jsonErr);
               isProcessing = false;
               return;
            }

            if (!Array.isArray(curOrders) || curOrders.length === 0) {
               isProcessing = false;
               return;
            }

            // Обрабатываем все объекты в массиве
            for (const data of curOrders) {
               // Проверяем наличие полей request и result
               if (!data?.req || !data?.res) {
                  continue; // пропускаем этот элемент
               }

               try {
                  console.log("попытка сделать ", data);

                  // вызываем saveSellData с правильными полями
                  await saveSellData(data.req, data.res);
               } catch (err) {
                  console.error("Ошибка при сохранении данных:", err);
                  // продолжаем обработку других элементов
               }
            }

         } catch (err) {
            console.error("Ошибка при обработке заказов:", err);
         } finally {
            isProcessing = false;
         }
      }, interval);
   }


   watchCurOrders();
}
