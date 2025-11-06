// src/features/sell/api/sellInterceptor.ts
import { enhanceAdRows } from "./sellAdProc";
import type { Ad, CreateResponse, OrderPayload } from "../../../shared/types/ads";


import { sendSellData } from "../api/sellApi";
import { backgroundProcessAds } from "./sellBackgroundProc";
import { setupSellButtonListener } from "../components/sellDOMHandlers";
import { checkTelegramResponse } from "../api/confirmOrder";

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

               // 0 = Sell

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
      // Внутри цикла while(true) для постоянного опроса
      while (true) {
         try {
            await checkTelegramResponse();

            // Если Telegram вернул пустой массив (timeout long polling), 
            // новый запрос отправится немедленно, без задержки.

         } catch (error) {
            // Если произошла сетевая ошибка, или другая критическая ошибка, 
            // делаем небольшую паузу, чтобы не спамить API.
            console.error("Критическая ошибка в цикле опроса, пауза...", error);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Пауза 5 секунд
         }
      }
   }

   // Запуск бота
   runBotPolling();
   function watchCurOrders() {
      let isProcessing = false; // защита от повторного выполнения
      const interval = 1000; // интервал проверки

      setInterval(async () => {
         if (isProcessing) return;
         isProcessing = true;

         try {
            const newValue = localStorage.getItem("tempSellData");
            if (!newValue) {
               isProcessing = false;
               return;
            }

            let curOrders: { req: OrderPayload, res: CreateResponse }[] = [];
            try {
               curOrders = JSON.parse(newValue);
            } catch (jsonErr) {
               console.error("Ошибка парсинга tempSellData:", jsonErr);
               localStorage.removeItem("tempSellData"); // сбрасываем повреждённые данные
               isProcessing = false;
               return;
            }

            if (!Array.isArray(curOrders) || curOrders.length === 0) {
               localStorage.removeItem("tempSellData"); // чистим, если пусто
               isProcessing = false;
               return;
            }

            const data = curOrders[0];
            if (!data?.req || !data?.res) {
               console.warn("Некорректная структура данных:", data);
               curOrders.shift(); // удаляем неверный элемент
               localStorage.setItem("tempSellData", JSON.stringify(curOrders));
               isProcessing = false;
               return;
            }

            try {
               // безопасный вызов sendSellData
               sendSellData(data.req, data.res);
            } catch (err) {
               console.error("Ошибка при отправке данных:", err);
               // если ошибка при отправке — не удаляем элемент, чтобы не потерять данные
               isProcessing = false;
               return;
            }

            // удаляем успешно обработанный элемент
            curOrders.shift();
            if (curOrders.length > 0) {
               localStorage.setItem("tempSellData", JSON.stringify(curOrders));
            } else {
               localStorage.removeItem("tempSellData");
            }
         } catch (err) {
            console.error("Ошибка при обработке заказов:", err);
         } finally {
            isProcessing = false;
         }
      }, interval);
   }


   watchCurOrders();
   // window.fetch = async (...args) => {
   //    const url = args[0].toString();
   //    const options = args[1];
   //    // логика сохранения данных ордера перенесена в Requestly, т.к. здесь скрипт перестал видеть перехваченные запросы
   //    // Перехват создания ордера на продажу и отправлям данные ордера в базу
   //    if (url.includes("x-api/fiat/otc/order/create") && options?.body) {

   //       const body: OrderPayload = JSON.parse(options.body as string);

   //       if (body.side === "1" && body.securityRiskToken !== "") {
   //          // 1 = Sell
   //          const response = await originalFetch(...args);
   //          // Отправляем данные после успешного ответа от Bybit

   //          response
   //             .clone()
   //             .json()
   //             .then((res: CreateResponse) => sendSellData(body, res));
   //          return response;
   //       }
   //    }

   //    return originalFetch(...args);
   // };
}
