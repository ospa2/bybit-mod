// src/features/buy/logic/buyOrderManager.ts


import { watchOrder } from "../../../shared/orders/orderWatcher.ts";
import { StorageHelper } from "../../../shared/storage/storageHelper.ts";
import type { ApiResult, Order, OrderData } from "../../../shared/types/ads";
import { type Card, loadCards, markCardAsUsed } from "../automation/adFinder.ts";


/**
 * Сохраняет данные нового ордера локально, обновляет статистику карты и запускает вочер.
 */
export async function saveOrderAndWatch(orderId: string, card: Card, apiResult: ApiResult, amountInput: HTMLInputElement | null): Promise<void> {
   let orders: OrderData[] = StorageHelper.getOrders();

   let cards: Card[] = loadCards();
   // 1. Помечаем карту как использованную 
   // ⭐ Эта функция должна быть либо вынесена в cardStorage, либо тут вызываем функцию markCardAsUsed из automation
   markCardAsUsed(card.id);

   // 2. Создаем объект нового ордера
   const fiatAmount = amountInput
      ? (parseFloat(amountInput.value) * parseFloat(String(apiResult.price))).toFixed(2).toString()
      : apiResult.maxAmount;

   const coinAmount = amountInput
      ? parseFloat(amountInput.value).toString()
      : (parseFloat(apiResult.maxAmount) / parseFloat(apiResult.price)).toFixed(4).toString();

   const newOrder: Order = {
      "Order No.": orderId,
      Type: "BUY",
      "Fiat Amount": fiatAmount,
      Price: apiResult.price,
      "Coin Amount": coinAmount,
      Counterparty: apiResult.nickName,
      Status: "pending",
      Time: new Date().toISOString(),
   };

   // 3. Запускаем вочер
   watchOrder(orderId, card);

   // 4. Обновляем карту в хранилище (баланс, оборот)
   const amountToUpdate = parseFloat(fiatAmount);

   cards = cards.map((c) =>
      c.id === card?.id
         ? {
            ...c,
            balance: c.balance - amountToUpdate,
            turnover: c.turnover + amountToUpdate,
         }
         : c
   );
   localStorage.setItem("!cards", JSON.stringify(cards));
   orders.push({ order: newOrder, card: card });
   StorageHelper.setOrders(orders);
}