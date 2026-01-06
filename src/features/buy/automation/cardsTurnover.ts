import { sendCardsToServer } from "../../../shared/orders/fetchCards";
import { loadCards } from "../../../shared/storage/storageHelper";

const RESET_KEY = 'last_daily_reset_date';
interface ResetStorage {
   getLastResetDate(): string | null; // ISO Date String (YYYY-MM-DD)
   setLastResetDate(dateStr: string): void;
}
const storage: ResetStorage = {
   getLastResetDate: () => localStorage.getItem(RESET_KEY),
   setLastResetDate: (dateStr: string) => localStorage.setItem(RESET_KEY, dateStr)
};

export function initializeDailyReset(): void {
   // Выполняем проверку немедленно при загрузке страницы/скрипта
   checkAndReset(storage);

   // Интервал проверяет необходимость сброса в реальном времени (например, если вкладка открыта в полночь)
   setInterval(() => checkAndReset(storage), 1000 * 60);
}

function checkAndReset(store: ResetStorage): void {
   const now = new Date();

   // Формируем YYYY-MM-DD в локальном времени
   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, '0');
   const day = String(now.getDate()).padStart(2, '0');
   const todayStr = `${year}-${month}-${day}`;

   const lastResetStr = store.getLastResetDate();

   // Если записи нет (первый запуск) или дата в конфиге меньше текущей
   if (!lastResetStr || lastResetStr < todayStr) {
      try {
         console.log('Выполняем сброс оборотов...');
         
         performDailyReset();
         store.setLastResetDate(todayStr);
         const cards = loadCards();
         sendCardsToServer(cards)
      } catch (error) {
         console.error("Критическая ошибка при сбросе оборотов:", error);
      }
   }
}

function performDailyReset() {
   try {
      const cards = loadCards()

      // Обнуляем turnover у всех карт
      const resetCards = cards.map((card) => ({
         ...card,
         turnover: 0,
      }));

      // Сохраняем обновленные карты
      localStorage.setItem("!cards", JSON.stringify(resetCards));

   } catch (e) {
      console.error("Error performing daily reset:", e);
   }
}