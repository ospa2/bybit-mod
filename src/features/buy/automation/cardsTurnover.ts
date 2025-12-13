import type { Card } from "../../../shared/types/reviews";

export function initializeDailyReset() {
   // Проверяем и сбрасываем при каждом запуске приложения
   checkAndResetIfNeeded();

   // Вычисляем время до следующей полуночи
   const now = new Date();
   const nextMidnight = new Date(now);
   nextMidnight.setDate(nextMidnight.getDate() + 1);
   nextMidnight.setHours(0, 0, 0, 0);

   const timeUntilMidnight = nextMidnight.getTime() - now.getTime();

   // Устанавливаем таймер ровно до следующей полуночи
   setTimeout(() => {
      performDailyReset();
      // После сброса в полночь запускаем новый цикл
      initializeDailyReset();
   }, timeUntilMidnight);
}

function performDailyReset() {
   const raw = localStorage.getItem("!cards");
   if (!raw) return;

   try {
      const cards: Card[] = JSON.parse(raw);

      // Обнуляем turnover у всех карт
      const resetCards = cards.map((card) => ({
         ...card,
         turnover: 0,
      }));

      // Сохраняем обновленные карты
      localStorage.setItem("!cards", JSON.stringify(resetCards));

      // Сохраняем дату последнего сброса
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      localStorage.setItem("!last_reset_date", today.toISOString());

      console.log(`Daily reset performed at ${new Date().toISOString()}`);
   } catch (e) {
      console.error("Error performing daily reset:", e);
   }
}

function checkAndResetIfNeeded() {
   const lastResetRaw = localStorage.getItem("!last_reset_date");
   const today = new Date();
   today.setHours(0, 0, 0, 0);

   if (!lastResetRaw) {
      // Первый запуск - выполняем сброс и сохраняем дату
      performDailyReset();
      return;
   }

   try {
      const lastResetDate = new Date(lastResetRaw);
      lastResetDate.setHours(0, 0, 0, 0);

      // Если последний сброс был не сегодня - выполняем сброс
      if (lastResetDate.getTime() < today.getTime()) {
         performDailyReset();
      }
   } catch (e) {
      console.error("Error checking last reset date:", e);
      // При ошибке делаем сброс на всякий случай
      performDailyReset();
   }
}