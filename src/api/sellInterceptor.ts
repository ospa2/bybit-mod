// src/services/fetchInterceptor.ts

import { enhanceAdRows } from "../logic/sellAdProc";
import { handleModalOpening } from "../logic/sellModal";
import { sendSellData } from "./bybitApi";
import { getRowIndex } from "../utils/domHelpers";
import type { Ad, CreateResponse } from "../types/ads";
import reviewsStatistics, { processUserReviews } from "../components/review";
import { adShouldBeFiltered } from "../logic/adFilter";
import type { Order, OrderPayload } from "../components/buyModal";
import type { Card } from "../automation/adFinder";
import { GM_xmlhttpRequest } from "$";

let currentButtonClickHandler: ((e: MouseEvent) => void) | null = null;
let onlineAdsData: Ad[] = []; // Локальное хранилище данных об объявлениях
function delay(ms: number) {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

let isBackgroundProcessRunning = false;

async function backgroundProcessAds(ads: Ad[]) {
   if (isBackgroundProcessRunning) {
      console.log(
         "⚠ backgroundProcessAds уже выполняется, новый запуск отменён"
      );
      return;
   }
   isBackgroundProcessRunning = true;
   console.log("▶ Запущен backgroundProcessAds");

   try {
      const newMerchantsAds = ads.filter(
         (ad) => reviewsStatistics.getByUserId(ad.userId) === null
      );
      const oldMerchantsAds = ads.filter(
         (ad) => reviewsStatistics.getByUserId(ad.userId) !== null
      );
      for (const ad of newMerchantsAds) {
         await processUserReviews(ad);

         await delay(1000); // пауза 1 сек, чтобы не заблокировали IP
      }
      for (const ad of oldMerchantsAds) {
         await processUserReviews(ad);

         await delay(1000); // пауза 1 сек, чтобы не заблокировали IP
      }
   } finally {
      isBackgroundProcessRunning = false;
   }
}

type OrderStatus = "pending" | "completed" | "cancelled" | string;

async function getOrderStatus(orderId: string): Promise<OrderStatus> {
   try {
      const response = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/order/info",
         {
            method: "POST", // <-- ВАЖНО
            headers: {
               "Content-Type": "application/json;charset=UTF-8",
               accept: "application/json",
               origin: "https://www.bybit.com",

               // сюда добавь нужные куки/токены/хэдеры
            },
            body: JSON.stringify({
               orderId: orderId,
            }),
            credentials: "include", // если нужны cookies
         }
      );

      const result = await response.json();

      return result.result.status === 50
         ? "completed"
         : result.result.status === 40
         ? "cancelled"
         : "pending";
   } catch (err) {
      console.error("❌ Fetch error:", err);
      return "error";
   }
}

// ==== Основной вотчер ====
export function watchOrder(orderId: string, card: Card): void {
   const interval = setInterval(async () => {
      try {
         const status = await getOrderStatus(orderId);
         console.log(`Статус ордера ${orderId}:`, status);

         if (status === "completed" || status === "cancelled") {
            clearInterval(interval);

            // обновляем статус в localStorage

            let orders: { order: Order; card: Card }[] = JSON.parse(
               localStorage.getItem("orders") || "[]"
            );
            let newOrder = orders.find((o) => o.order["Order No."] === orderId);
            orders = orders.filter(
               (order) => order.order["Order No."] !== orderId
            );
            localStorage.setItem("orders", JSON.stringify(orders));

            if (status === "completed" && newOrder) {
               console.log(`✅ Ордер ${orderId} завершён`);
               // отправляем на сервер
               newOrder.order.Status = "Completed";
               GM_xmlhttpRequest({
                  method: "POST",
                  url: "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders",
                  headers: {
                     "Content-Type": "application/json",
                     Accept: "application/json",
                  },
                  data: JSON.stringify(newOrder),
                  onload: (response: any): void => {
                     console.log(
                        "Запрос успешно отправлен!",
                        response.status,
                        response.responseText
                     );
                  },
                  onerror: (response: any): void => {
                     console.error(
                        "Ошибка при отправке запроса:",
                        response.status,
                        response.statusText
                     );
                  },
               });
            } else if (status === "cancelled" && newOrder) {
               console.log(`❌ Ордер ${orderId} отменён`);
               // отправляем на сервер
               newOrder.order.Status = "Cancelled";
               GM_xmlhttpRequest({
                  method: "POST",
                  url: "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders",
                  headers: {
                     "Content-Type": "application/json",
                     Accept: "application/json",
                  },
                  data: JSON.stringify(newOrder),
                  onload: (response: any): void => {
                     console.log(
                        "Запрос успешно отправлен!",
                        response.status,
                        response.responseText
                     );
                  },
                  onerror: (response: any): void => {
                     console.error(
                        "Ошибка при отправке запроса:",
                        response.status,
                        response.statusText
                     );
                  },
               });
               // обновляем карты
               let cards: Card[] = JSON.parse(
                  localStorage.getItem("cards_v1") || "[]"
               );
               cards = cards.map((c) => (c.id === card.id ? card : c));
               localStorage.setItem("cards_v1", JSON.stringify(cards));
            }
         }
      } catch (error) {
         console.error("Ошибка при проверке статуса:", error);
      }
   }, 5000);
}
// ==== Восстановление при загрузке страницы ====

export function initFetchInterceptor() {
   const originalFetch = window.fetch;

   window.fetch = async (...args) => {
      const url = args[0].toString();
      const options = args[1];

      // Перехват списка объявлений на продажу
      if (url.includes("/x-api/fiat/otc/item/online") && options?.body) {
         const body = JSON.parse(options.body as string);

         if (body.side === "0") {
            // 0 = Sell

            const response = await originalFetch(...args);
            const clonedResponse = response.clone();
            clonedResponse.json().then((data) => {
               onlineAdsData = data.result.items || [];
               enhanceAdRows(onlineAdsData);
               setupSellButtonListener();

               // Запускаем фоновый процесс
               const filteredAds = onlineAdsData.filter(
                  (ad) => !adShouldBeFiltered(ad)
               );
               backgroundProcessAds(filteredAds);
            });
            return response;
         }
      }

      // Перехват создания ордера на продажу и отправлям данные ордера в базу
      if (url.includes("x-api/fiat/otc/order/create") && options?.body) {
         const body: OrderPayload = JSON.parse(options.body as string);

         if (body.side === "1" && body.securityRiskToken !== "") {
            // 1 = Sell
            const response = await originalFetch(...args);
            // Отправляем данные после успешного ответа от Bybit

            response
               .clone()
               .json()
               .then((res: CreateResponse) => sendSellData(body, res));
            return response;
         }
      }

      return originalFetch(...args);
   };
}

function setupSellButtonListener() {
   // Удаляем старый обработчик, чтобы избежать дублирования
   if (currentButtonClickHandler) {
      document.removeEventListener("click", currentButtonClickHandler);
   }

   currentButtonClickHandler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (btn && btn.innerText.includes("Продать USDT")) {
         const index = getRowIndex(btn);
         if (index !== -1 && onlineAdsData[index]) {
            handleModalOpening(onlineAdsData[index], e);
         }
      }
   };

   document.addEventListener("click", currentButtonClickHandler);
}
