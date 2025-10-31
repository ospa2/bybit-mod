// src/features/sell/api/sellInterceptor.ts
import { enhanceAdRows } from "./sellAdProc";
import type { Ad, CreateResponse, OrderPayload } from "../../../shared/types/ads";


import { sendSellData } from "../api/sellApi";
import { backgroundProcessAds } from "./sellBackgroundProc";
import { setupSellButtonListener } from "../components/sellDOMHandlers";

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



   function watchCurOrders() {
      setInterval(async () => {
         const newValue = localStorage.getItem("tempSellData");
         console.log("🚀 ~ watchCurOrders ~ newValue:", newValue)
         

         if (newValue) {

            try {
               const curOrders: { req: OrderPayload, res: CreateResponse }[] = JSON.parse(newValue);
               const data = curOrders[0];

               const req = data.req;

               const res = data.res;

               // 0 = Sell

               sendSellData(req, res);
               curOrders.shift();
               localStorage.setItem("tempSellData", JSON.stringify(curOrders));


            } catch (err) {
               console.error("Ошибка при обработке unknownUserIds:", err);
            }
         }
      }, 1000); // проверка раз в секунду
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
