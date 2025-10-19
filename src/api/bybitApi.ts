import { createRowFromTemplate } from "../components/buyRow.ts";
import { adShouldBeFiltered } from "../logic/adFilter.ts";
import { USER_ID } from "../config.ts";
import { appState } from "../state.ts";
import { GM_xmlhttpRequest } from "$";

import {
   openBuyModal,
   type Order,
   type OrderPayload,
} from "../components/buyModal.ts";
import {
   findBestBuyAd,
   findSellCard,
   loadCards,
   type Card,
} from "../automation/adFinder.ts";
import { watchOrder } from "./sellInterceptor.ts";
import type { Ad, CreateResponse } from "../types/ads";
import { getRowIndex } from "../utils/domHelpers.ts";
function now() {
   return new Date().toISOString();
}

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
         tbody.querySelectorAll(".dynamic-row").forEach((row) => row.remove());
         tbody.querySelector(".completion-indicator")?.remove();
         return;
      }

      // Если мы здесь — это buy страница
      if (!currentUrl.includes("/buy/USDT/RUB")) {
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
         size: "150",
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
      const ads: Ad[] = json.result.items || {};

      // Удаляем старые строки и индикатор
      tbody.querySelectorAll(".dynamic-row").forEach((row) => row.remove());
      tbody.querySelector(".completion-indicator")?.remove();

      // Создаем фрагмент и добавляем строки (приоритетные — наверх)
      const fragment = document.createDocumentFragment();

      const minPrice = Math.min(...ads.filter((ad: Ad) => !adShouldBeFiltered(ad)).map((a: Ad) => parseFloat(a.price)));

      if (ads) {
         for (let i = 0; i < ads.length; i++) {

            try {
               const ad = ads[i];
               if(adShouldBeFiltered(ad)) continue;
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

         const adAndCard = findBestBuyAd(ads);
         console.log(
            "card:",
            adAndCard?.card.id,
            "counterparty: ",
            adAndCard?.ad.nickName
         );

         if (adAndCard) {
            openBuyModal(adAndCard, minPrice, true); // автоматическое создание ордера
         }

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

   let orders: { order: Order; card: Card }[] = JSON.parse(
      localStorage.getItem("!orders") || "[]"
   );

   console.log('запуск хуйни');

   for (const order of orders) {
      if (order.order.Status === "pending") {
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
export function sendSellData(body: OrderPayload, result: CreateResponse) {
   //отправляем данные ордера в базу данных
   if (result.ret_code !== 0) return;
   let orders: { order: Order; card: Card }[] = JSON.parse(
      localStorage.getItem("!orders") || "[]"
   );
   let cards: Card[] = loadCards()

   const card = findSellCard(body);
   const maxAmount = parseFloat(body.amount);
   if (card) watchOrder(result.result.orderId, card);

   cards = cards.map((c) =>
      c.id === card?.id
         ? {
            ...c,
            balance: c.balance + maxAmount,
            turnover: c.turnover + maxAmount,
            // Дата уже будет сегодняшней после вызова loadCards
         }
         : c
   );
   localStorage.setItem("!cards", JSON.stringify(cards));
   // Получаем имя из модального окна, сохраненного в appState

   const nickName = appState.counterpartyNickname;

   const newOrder = {
      "Order No.": result.result.orderId,
      Type: "SELL",
      "Fiat Amount": body.amount,
      Price: (parseFloat(body.amount) / parseFloat(body.quantity)).toFixed(2),
      "Coin Amount": body.quantity,
      Counterparty: nickName,
      Status: "pending",
      Time: new Date().toISOString(),
   };

   GM_xmlhttpRequest({
      method: "POST",
      url: "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders",
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(newOrder),
      onload: (response) =>
         console.log("Ордер успешно отправлен:", response.status),
      onerror: (response) =>
         console.error("Ошибка отправки ордера:", response.error),
   });
   if (card) {
      orders.push({ order: newOrder, card: card });
      localStorage.setItem("!orders", JSON.stringify(orders));
   }
}

interface SendOrderMessageParams {
   message: string;
   orderId: string;
}
async function signRequest(
   apiSecret: string,
   payload: string
): Promise<string> {
   const encoder = new TextEncoder();

   const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
   );

   const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
   );

   return Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
}

export async function sendOrderMessage({
   message,
   orderId,
}: SendOrderMessageParams): Promise<any> {
   const apiKey = "K8CPRLuqD302ftIfua";
   const apiSecret = "E86RybeO4tLjoXiR5YYtbVStHC9qXCHDBeOI";

   const url = "https://api-testnet.bybit.com/v5/p2p/item/online";
   const timestamp = Date.now().toString();
   const recvWindow = "5000";

   const body = JSON.stringify({
      message,
      contentType: "str",
      orderId,
   });

   const payload = timestamp + apiKey + recvWindow + body;
   const signature = await signRequest(apiSecret, payload);

   const response = await fetch(url, {
      method: "POST",
      headers: {
         "X-BAPI-API-KEY": apiKey,
         "X-BAPI-SIGN": signature,
         "X-BAPI-TIMESTAMP": timestamp,
         "X-BAPI-RECV-WINDOW": recvWindow,
         "Content-Type": "application/json",
      },
      body,
   });

   return await response.json();
}
