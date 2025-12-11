import { sendOrderToServer } from "../../features/sell/api/sellApi";
import { restoreCardBalance, updateCardBalance, removeOrderFromStorage, loadCards } from "../storage/storageHelper";
import type { OrderData } from "../types/ads";
import type { Card } from "../types/reviews";
import { sendCardsToServer } from "./fetchCards";
import { getUsedCard } from "./orderCard";

// Обработка завершённого ордера
export async function handleCompletedOrder(
   orderId: string,
   originalCard: Card,
   orderData: OrderData
): Promise<void> {
   console.log(`✅ Ордер ${orderId} завершён`);

   try {
      let actuallyUsedCard = await getUsedCard(orderId);

      if (!actuallyUsedCard) {
         // в сообщениях в ордере не указана карта
         actuallyUsedCard = originalCard
      };

      restoreCardBalance(originalCard);// баланс предложенной карты восстанавливаем
      let rubleAmount = parseFloat(orderData.order["Fiat Amount"]);
      orderData.order.Type === "BUY" ? rubleAmount = -rubleAmount : rubleAmount = rubleAmount
      updateCardBalance(actuallyUsedCard.id, rubleAmount);// баланс использованной карты обновляем.

      // Отправляем на сервер
      orderData.order.Status = "Completed";
      await sendOrderToServer(orderData);
      const cards = loadCards();
      sendCardsToServer(cards);
   } catch (error) {
      console.error(`Ошибка при обработке завершённого ордера ${orderId}:`, error);
      throw error;
   }
}

// Обработка отменённого ордера
export async function handleCancelledOrder(
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
      const cards = loadCards();
      sendCardsToServer(cards);
   } catch (error) {
      console.error(`Ошибка при обработке отменённого ордера ${orderId}:`, error);
      throw error;
   }
}

// Обработка завершения ордера (completed или cancelled)
export async function handleOrderCompletion(
   orderId: string,
   originalCard: Card,
   status: string
): Promise<void> {
   const orderData = removeOrderFromStorage(orderId);

   if (!orderData) {
      console.error(`Не удалось найти данные ордера ${orderId}`);
      return;
   }
   (window as any).manager.stopForOrder(orderId);
   if (status === "completed") {
      await handleCompletedOrder(orderId, originalCard, orderData);
   } else if (status === "cancelled") {
      await handleCancelledOrder(orderId, originalCard, orderData);
   }
}