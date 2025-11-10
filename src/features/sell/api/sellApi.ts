import { GM_xmlhttpRequest } from "$";
import { appState } from "../../../core/state";
import { watchOrder } from "../../../shared/orders/orderWatcher";
import { StorageHelper } from "../../../shared/storage/storageHelper";
import type { OrderPayload, CreateResponse, OrderData } from "../../../shared/types/ads";
import { loadCards, findSellCard, type Card } from "../../buy/automation/adFinder";

const API_URL = "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders";

export function sendSellData(body: OrderPayload, result: CreateResponse) {

   //функция вызывается при создании ордера

   if (result.ret_code !== 0) return;
   let orders: OrderData[] = StorageHelper.getOrders();
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

   if (card) {
      orders.push({ order: newOrder, card: card });
      StorageHelper.setOrders(orders);
   }
}


// Отправка данных на сервер
export async function sendOrderToServer(orderData: OrderData): Promise<void> {
   return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
         method: "POST",
         url: API_URL,
         headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
         },
         data: JSON.stringify(orderData.order),
         onload: (response: any): void => {
            console.log(
               "✅ ордер отправлен на сервер:",
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
