// ==== Основной вотчер ====
import type { Card } from "../types/reviews";
import { handleOrderCompletion } from "./orderCompletionHandler";
import { getOrderStatus } from "./orderStatusChecker";

// Константы
const CHECK_INTERVAL = 5000; // 5 секунд
const MAX_ATTEMPTS = 360; // 30 минут



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