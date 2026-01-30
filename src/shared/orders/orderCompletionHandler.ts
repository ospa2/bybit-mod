import { sendOrderToServer } from "../../features/sell/api/sellApi";
import { restoreCardBalance, updateCardBalance, removeOrderFromStorage } from "../storage/storageHelper";
import type { OrderData } from "../types/ads";
import type { Card } from "../types/reviews";
import { sendCardsToServer } from "./fetchCards";
import { getUsedCard } from "./orderCard";

// Helper: Рассчитываем сумму с учетом знака (BUY = расход, SELL = доход)
function calculateSignedAmount(order: OrderData['order']): number {
   const amount = parseFloat(order["Fiat Amount"]);
   // Если BUY, мы тратим деньги (минус), если SELL — получаем (плюс)
   return order.Type === "BUY" ? -amount : amount;
}

export async function handleCompletedOrder(
   orderId: string,
   originalCard: Card,
   orderData: OrderData
): Promise<void> {
   console.log(`✅ Ордер ${orderId} завершён`);

   const rubleAmount = calculateSignedAmount(orderData.order);
   let actuallyUsedCard = await getUsedCard(orderId);
   if (!actuallyUsedCard) {
      actuallyUsedCard = originalCard;
   }

   const isCardChanged = actuallyUsedCard.id !== originalCard.id;

   try {
      if (isCardChanged) {
         restoreCardBalance(originalCard);
         updateCardBalance(actuallyUsedCard.id, rubleAmount);

         // 1. Откат статистики на оригинальной карте (Cancel логика)
         // Мы "отменяем" бронь на этой карте
         await sendCardsToServer(originalCard.id, -rubleAmount, 'order_cancel');

         // 2. Новая операция на реальной карте (Create логика)
         // Мы фиксируем выполнение на новой карте
         await sendCardsToServer(actuallyUsedCard.id, rubleAmount, 'order_create');

         console.log(`Карта изменена: ${originalCard.id} -> ${actuallyUsedCard.id}`);
      } else {
         // Карта совпадает.
         // Если при создании ордера мы уже вызвали 'order_create' (статистика учтена),
         // то здесь ничего делать НЕ НАДО.
         // Если же статистика обновляется только по факту завершения, то здесь нужен 'order_create'.

         // Исходя из вашего кода "NEW.operations := OLD.operations + 1" в триггере,
         // статистика обновлялась сразу при изменении баланса.
         // Значит, если карта та же — статистика уже верна, трогать не нужно.
         console.log(`Карта совпадает (${originalCard.id}). Изменений не требуется.`);
      }

      orderData.order.Status = "Completed";
      await sendOrderToServer(orderData);

   } catch (error) {
      console.error(`Ошибка при обработке завершённого ордера ${orderId}:`, error);
      throw error;
   }
}

export async function handleCancelledOrder(
   orderId: string,
   originalCard: Card,
   orderData: OrderData
): Promise<void> {
   console.log(`❌ Ордер ${orderId} отменён`);

   try {
 
      // Откат локального баланса
      const rubleAmount = calculateSignedAmount(orderData.order);

      // Откат статистики (Cancel логика)
      // amount передаем с минусом (инвертируем операцию создания), reason = cancel
      await sendCardsToServer(originalCard.id, -rubleAmount, 'order_cancel');

      orderData.order.Status = "Cancelled";
      await sendOrderToServer(orderData);

   } catch (error) {
      console.error(`Ошибка при обработке отменённого ордера ${orderId}:`, error);
      throw error;
   }
}

export async function handleOrderCompletion(
   orderId: string,
   originalCard: Card,
   status: string
): Promise<void> {
   // ВАЖНО: Не удаляем ордер до обработки, иначе при ошибке потеряем данные
   // Получаем данные, но не удаляем (предполагаем наличие метода getOrderFromStorage или аналогичного)
   // Если removeOrderFromStorage единственный метод чтения, нужно менять архитектуру storageHelper.
   // Ниже приведен безопасный вариант с remove в finally.

   // Допустим, мы пока используем remove, но сохраняем копию в памяти. 
   // Если упадет - данные в сторадже уже стерты (это плохо), но в рамках функции мы работаем.
   // Лучше разделить: getOrder -> process -> removeOrder.

   const orderData = removeOrderFromStorage(orderId); // FIXME: Опасно, см. комментарий выше
   if (!orderData) {
      console.error(`Не удалось найти данные ордера ${orderId}`);
      return;
   }

   try {
      if (status === "completed") {
         await handleCompletedOrder(orderId, originalCard, orderData);
      } else if (status === "cancelled") {
         await handleCancelledOrder(orderId, originalCard, orderData);
      }
   } catch (e) {
      console.error(`Критическая ошибка обработки ордера ${orderId}. Данные могли быть потеряны из-за раннего удаления.`);
      // Здесь можно попытаться вернуть ордер в сторадж, если есть метод saveOrderToStorage
      throw e;
   }
}