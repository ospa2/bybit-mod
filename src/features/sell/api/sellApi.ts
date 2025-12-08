import { GM_xmlhttpRequest } from "$";
import { appState } from "../../../core/state";
import { sendCardsToServer } from "../../../shared/orders/fetchCards";
import { cardToMessage } from "../../../shared/orders/orderCard";
import { watchOrder } from "../../../shared/orders/orderWatcher";
import { loadCards, StorageHelper } from "../../../shared/storage/storageHelper";
import type { Ad, CreateResponse, OrderData, OrderPayload } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { markCardAsUsed } from "../../buy/automation/adFinder";
import { findSellCard } from "../automation/sellCardSelector";

const API_URL = "https://orders-finances-68zktfy1k-ospa2s-projects.vercel.app/api/orders";

export async function saveSellData(request: OrderPayload, result: CreateResponse) {

   //функция вызывается при создании ордера

   if (result.ret_code !== 0) return;
   let ordersRaw = localStorage.getItem("!orders");
   let orders = ordersRaw ? JSON.parse(ordersRaw) : [];

   let cards: Card[] = loadCards()
   const curAds: Ad[] = JSON.parse(localStorage.getItem("curAds") || "[]");

   const remark = curAds.find((a) => a.id === request.itemId)?.remark

   const card = findSellCard(request, remark);
   const maxAmount = parseFloat(request.amount);
   
   if (card) watchOrder(result.result.orderId, card);

   cards = cards.map((c) =>
      c.id === card?.id
         ? {
            ...c,
            balance: c.balance + parseFloat(maxAmount.toFixed(1)),
            turnover: c.turnover + parseFloat(maxAmount.toFixed(1)),
            // Дата уже будет сегодняшней после вызова loadCards
         }
         : c
   );
   if (card) {
      markCardAsUsed(card.id);
   }
   localStorage.setItem("!cards", JSON.stringify(cards));
   // Получаем имя из модального окна, сохраненного в appState

   const nickName = appState.counterpartyNickname;

   const newOrder = {
      "Order No.": result.result.orderId,
      Type: "SELL",
      "Fiat Amount": request.amount,
      Price: (parseFloat(request.amount) / parseFloat(request.quantity)).toFixed(2),
      "Coin Amount": request.quantity,
      Counterparty: nickName,
      Status: "pending",
      Time: new Date().toISOString(),
   };

   if (orders) {
      // Удаляем объект {request, result} который был передан в функцию
      orders = orders.filter((item: any) =>
         !(item.req && item.res &&
            item.res.result?.orderId === result.result.orderId)
      );

      // Добавляем новый объект
      orders.push({ order: newOrder, card: card });
      StorageHelper.setOrders(orders);
      sendCardsToServer(cards);
   }
   if ((window as any).wsClient) {
      await (window as any).wsClient.sendMessage({
         orderId: result.result.orderId,
         message: "Привет"
      });
      if (remark) {
         const regex = new RegExp(/номер[уа]?\s?карт/g);
         const poNomeruKarti: boolean = regex.test(remark);
         if (card) {
            await (window as any).wsClient.sendMessage({
               orderId: result.result.orderId,
               message: cardToMessage(card, !poNomeruKarti)
            });
         }
      }

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
