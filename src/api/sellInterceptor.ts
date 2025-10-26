// src/services/fetchInterceptor.ts

import { enhanceAdRows } from "../logic/sellAdProc";
import { handleModalOpening } from "../logic/sellModal";
import { sendSellData } from "./bybitApi";
import { getRowIndex } from "../utils/domHelpers";
import type { Ad, CreateResponse } from "../types/ads";
import reviewsStatistics, { processUserReviews } from "../components/review";
import type { Order, OrderPayload } from "../components/buyModal";
import { loadCards, type Card } from "../automation/adFinder";
import { GM_xmlhttpRequest } from "$";

let currentButtonClickHandler: ((e: MouseEvent) => void) | null = null;
let onlineAdsData: Ad[] = []; // Локальное хранилище данных об объявлениях
function delay(ms: number) {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

let isBackgroundProcessRunning = false;

export async function backgroundProcessAds() {

   const newSellersAdsRaw = localStorage.getItem("unknownUserIds") || "[]";//объявления от новых продавцов
   const ads: Ad[] = JSON.parse(newSellersAdsRaw);
   if (isBackgroundProcessRunning) {
      console.log(
         "⚠ backgroundProcessAds уже выполняется, новый запуск отменён"
      );
      return;
   }
   isBackgroundProcessRunning = true;
   console.log("▶ Запущен backgroundProcessAds");

   try {
      const oldMerchantsAds = ads.filter(
         (ad) => reviewsStatistics.getByUserId(ad.userId) !== null
      );
      for (const ad of ads) {
         await processUserReviews(ad);
         const newValue = localStorage.getItem("unknownUserIds") || "[]";
         const newSellerAds: Ad[] = JSON.parse(newValue);


         const nextSellerAds = newSellerAds.filter((item: Ad) => item.userId !== ad.userId);

         localStorage.setItem("unknownUserIds", JSON.stringify(nextSellerAds));
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

export async function getUsedCard(orderId: string): Promise<Card | null> {
   try {
      const cards: Card[] = loadCards()

      const res = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/order/message/listpage",
         {
            method: "POST",
            headers: {
               "Content-Type": "application/json;charset=UTF-8",
               accept: "application/json",
               origin: "https://www.bybit.com",
            },
            body: JSON.stringify({
               orderId: orderId,
               currentPage: "1",
               size: "100",
            }),
            credentials: "include",
         }
      ).then((response) => response.json());

      console.log("📨 Ответ от API:", res);

      const messages = res.result.result.map((m: any) => m.message);
      console.log("💬 Messages:", messages);

      let foundCard: Card | null = null;

      messages.forEach((message: string) => {
         console.log("➡️ Обрабатываем message:", message);

         switch (message) {
            case "79525176865 Татьяна Г сбер":
            case "2202208354725872":
            case "Взаимный лайк💚":
               foundCard = cards.find((c: Card) => c.id === "mamaSber") || null
               break;

            case "79525181633 Никита К сбер":
            case "2202208354718000":
            case "Взaимный лайк💚":
               foundCard = cards.find((c: Card) => c.id === "papaSber") || null
               break;

            case "79514513792 Серафим Г сбер":
            case "2202208034462813":
            case "Взаимный лaйк💚":
               foundCard = cards.find((c: Card) => c.id === "seraphimSber") || null
               break;

            case "79514513792 Серафим Г тбанк":
            case "2200701913770423":
            case "Взаимный лaйк💛":
               foundCard = cards.find((c: Card) => c.id === "seraphimTbank") || null
               break;

            case "79227518402 Галина Г тбанк":
            case "2200701940041368":
            case "Взaимный лайк💛":
               foundCard = cards.find((c: Card) => c.id === "galyaTbank") || null
               break;
         }

         if (foundCard) {
            console.log("✅ Найдена карта:", foundCard);
         } else {
            console.log("❌ Карта не найдена для message:", message);
         }
      });

      return foundCard;
   } catch (error) {
      console.error("🔥 Ошибка в getOrderCard:", error);
   }

   return null;
}


// ==== Основной вотчер ====
// Константы
const CHECK_INTERVAL = 5000; // 5 секунд
const MAX_ATTEMPTS = 360; // 30 минут
const API_URL = "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders";

// Типы
interface OrderData {
   order: Order;
   card: Card;
}

// Утилиты для работы с localStorage
class StorageHelper {
   static safeGetJSON<T>(key: string, fallback: T): T {
      try {
         const data = localStorage.getItem(key);
         return data ? JSON.parse(data) : fallback;
      } catch (error) {
         console.error(`Ошибка чтения ${key} из localStorage:`, error);
         return fallback;
      }
   }

   static safeSetJSON(key: string, value: any): boolean {
      try {
         localStorage.setItem(key, JSON.stringify(value));
         return true;
      } catch (error) {
         console.error(`Ошибка записи ${key} в localStorage:`, error);
         return false;
      }
   }

   static getOrders(): OrderData[] {
      return this.safeGetJSON<OrderData[]>("!orders", []);
   }

   static setOrders(orders: OrderData[]): void {
      this.safeSetJSON("!orders", orders);
   }

   static getCards(): Card[] {
      return this.safeGetJSON<Card[]>("!cards", []);
   }

   static setCards(cards: Card[]): void {
      this.safeSetJSON("!cards", cards);
   }
}

// Отправка данных на сервер
async function sendOrderToServer(orderData: OrderData): Promise<void> {
   return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
         method: "POST",
         url: API_URL,
         headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
         },
         data: JSON.stringify(orderData),
         onload: (response: any): void => {
            console.log(
               "✅ Заказ отправлен на сервер:",
               response.status,
               response.responseText
            );
            resolve();
         },
         onerror: (response: any): void => {
            console.error(
               "❌ Ошибка отправки на сервер:",
               response.status,
               response.statusText
            );
            reject(new Error(response.statusText));
         },
      });
   });
}

// Удаление ордера из хранилища
function removeOrderFromStorage(orderId: string): OrderData | null {
   const orders = StorageHelper.getOrders();
   const orderData = orders.find((o) => o.order["Order No."] === orderId);

   if (!orderData) {
      console.warn(`Ордер ${orderId} не найден в localStorage`);
      return null;
   }

   const filteredOrders = orders.filter(
      (order) => order.order["Order No."] !== orderId
   );
   StorageHelper.setOrders(filteredOrders);

   return orderData;
}

// Обновление баланса карты
function updateCardBalance(cardId: string, balanceChange: number): void {
   const cards: Card[] = loadCards()
   const updatedCards = cards.map((c) => {
      if (c.id === cardId) {
         return {
            ...c,
            balance: c.balance + balanceChange,
            turnover: c.turnover + Math.abs(balanceChange),
         };
      }
      return c;
   });
   StorageHelper.setCards(updatedCards);
}

// Восстановление баланса карты до исходного значения
function restoreCardBalance(originalCard: Card): void {
   // originalCard - это данные карты до создания ордера
   const cards: Card[] = loadCards()
   const updatedCards = cards.map((c) =>
      c.id === originalCard.id ? { ...originalCard } : c
   );
   StorageHelper.setCards(updatedCards);
}

// Обработка завершённого ордера
async function handleCompletedOrder(
   orderId: string,
   originalCard: Card,
   orderData: OrderData
): Promise<void> {
   console.log(`✅ Ордер ${orderId} завершён`);

   try {
      const actuallyUsedCard = await getUsedCard(orderId);

      if (actuallyUsedCard) {
         restoreCardBalance(originalCard);// баланс предложенной карты восстанавливаем
         let rubleAmount = parseFloat(orderData.order["Fiat Amount"]);
         orderData.order.Type === "BUY" ? rubleAmount = -rubleAmount : rubleAmount = rubleAmount
         updateCardBalance(actuallyUsedCard.id, rubleAmount);// баланс использованной карты обновляем.
      }

      // Отправляем на сервер
      orderData.order.Status = "Completed";
      await sendOrderToServer(orderData);
   } catch (error) {
      console.error(`Ошибка при обработке завершённого ордера ${orderId}:`, error);
      throw error;
   }
}

// Обработка отменённого ордера
async function handleCancelledOrder(
   orderId: string,
   originalCard: Card,
   orderData: OrderData
): Promise<void> {
   console.log(`❌ Ордер ${orderId} отменён`);

   try {
      // Возвращаем баланс карты
      restoreCardBalance(originalCard);

      // Отправляем на сервер
      orderData.order.Status = "Cancelled";
      await sendOrderToServer(orderData);
   } catch (error) {
      console.error(`Ошибка при обработке отменённого ордера ${orderId}:`, error);
      throw error;
   }
}

// Обработка завершения ордера (completed или cancelled)
async function handleOrderCompletion(
   orderId: string,
   originalCard: Card,
   status: string
): Promise<void> {
   const orderData = removeOrderFromStorage(orderId);

   if (!orderData) {
      console.error(`Не удалось найти данные ордера ${orderId}`);
      return;
   }

   if (status === "completed") {
      await handleCompletedOrder(orderId, originalCard, orderData);
   } else if (status === "cancelled") {
      await handleCancelledOrder(orderId, originalCard, orderData);
   }
}

// Основная функция наблюдения за ордером
export function watchOrder(orderId: string, card: Card): () => void {
   let attemptCount = 0;
   let consecutiveErrors = 0;
   const MAX_CONSECUTIVE_ERRORS = 5;

   const interval = setInterval(async () => {
      try {
         // Проверка таймаута
         if (attemptCount++ >= MAX_ATTEMPTS) {
            console.error(`⏱️ Превышено время ожидания для ордера ${orderId}`);
            clearInterval(interval);
            return;
         }

         // Получение статуса
         const status = await getOrderStatus(orderId);
         console.log(`📊 Статус ордера ${orderId}: ${status} (попытка ${attemptCount}/${MAX_ATTEMPTS})`);

         // Сброс счётчика ошибок при успешном запросе
         consecutiveErrors = 0;

         // Обработка финальных статусов
         if (status === "completed" || status === "cancelled") {
            clearInterval(interval);
            await handleOrderCompletion(orderId, card, status);
         }
      } catch (error) {
         consecutiveErrors++;
         console.error(
            `❌ Ошибка при проверке статуса ордера ${orderId} (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
            error
         );

         // Остановка после серии ошибок
         if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`🛑 Слишком много ошибок подряд для ордера ${orderId}. Остановка наблюдения.`);
            clearInterval(interval);
         }
      }
   }, CHECK_INTERVAL);

   // Возвращаем функцию для ручной остановки наблюдения
   return () => {
      console.log(`🛑 Остановка наблюдения за ордером ${orderId}`);
      clearInterval(interval);
   };
}

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
               setupSellButtonListener();

               backgroundProcessAds();


            } catch (err) {
               console.error("Ошибка при обработке unknownUserIds:", err);
            }
         }
      }, 1000); // проверка раз в секунду
   }

   watchCurAds();
   const originalFetch = window.fetch;



   function watchCurOrders() {
      setInterval(async () => {
         const newValue = localStorage.getItem("tempSellData");

         if (newValue) {

            try {
               const curOrders = JSON.parse(newValue);
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
   window.fetch = async (...args) => {
      const url = args[0].toString();
      const options = args[1];
      // логика сохранения данных ордера перенесена в Requestly, т.к. здесь скрипт перестал видеть перехваченные запросы
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
