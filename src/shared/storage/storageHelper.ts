// src/shared/storage/StorageHelper.ts

import type { OrderData } from "../types/ads";
import type { Card, CardUsageMap, ReviewStats } from "../types/reviews";
import { isSameDay } from "../utils/timeStuff";

const REVIEWSSTATISTICS = "reviewsStatistics_v1";
const CARDS_LAST_USED = '!cards_last_used';

export const reviewsStatistics = {
   data: (function loadFromStorage(): ReviewStats[] {
      // ... (Ваша функция loadFromStorage без изменений)
      try {
         const raw = localStorage.getItem(REVIEWSSTATISTICS);
         const parsed = raw ? JSON.parse(raw) : [];
         return parsed;
      } catch (e) {
         console.warn(
            "Не удалось прочитать reviewsStatistics из GM-хранилища:",
            e
         );
         return [];
      }
   })(),

   _saveToStorage(): void {
      // ... (Ваша функция _saveToStorage без изменений)
      try {
         localStorage.setItem(REVIEWSSTATISTICS, JSON.stringify(this.data));
      } catch (e) {
         console.warn(
            "Не удалось сохранить reviewsStatistics в GM-хранилище:",
            e
         );
      }
   },

   add(stats: ReviewStats): void {
      // ... (Ваша функция add без изменений)
      const existingIndex = this.data.findIndex(
         (item) => item.userId === stats.userId
      );
      const newEntry: ReviewStats = { ...stats };

      if (existingIndex !== -1) {
         this.data[existingIndex] = newEntry;
      } else {
         this.data.push(newEntry);
      }

      this._saveToStorage();
   },

   // ... (Остальные методы: getAll, getLast, clear, getByUserId)
   getAll(): ReviewStats[] {
      return this.data.slice();
   },

   getLast(): ReviewStats | null {
      return this.data.length ? this.data[this.data.length - 1] : null;
   },

   clear(): void {
      this.data = [];
      this._saveToStorage();
   },

   getByUserId(userId: string): ReviewStats | null {
      return this.data.find((item) => item.userId === userId) || null;
   },
};

// Утилиты для работы с localStorage
export class StorageHelper {
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

// Удаление ордера из хранилища
export function removeOrderFromStorage(orderId: string): OrderData | null {
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
export function updateCardBalance(cardId: string, balanceChange: number): void {
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
   let cardsLastUsedRaw = localStorage.getItem("!cards_last_used") ?? "{}";
   let cardsLastUsed = JSON.parse(cardsLastUsedRaw);

   if (cardsLastUsed.hasOwnProperty(cardId)) {
      cardsLastUsed[cardId] = Date.now(); // минус 20 минут
   }

   localStorage.setItem("!cards_last_used", JSON.stringify(cardsLastUsed));
   StorageHelper.setCards(updatedCards);
}

// Восстановление баланса карты до исходного значения
export function restoreCardBalance(originalCard: Card): void {
   // originalCard - это данные карты до создания ордера
   const cards: Card[] = loadCards()
   const updatedCards = cards.map((c) =>
      c.id === originalCard.id ? { ...originalCard } : c
   );

   let cardsLastUsedRaw = localStorage.getItem("!cards_last_used") ?? "{}";
   let cardsLastUsed = JSON.parse(cardsLastUsedRaw);

   if (cardsLastUsed.hasOwnProperty(originalCard.id)) {
      cardsLastUsed[originalCard.id] -= 20 * 60 * 1000; // минус 20 минут
   }

   localStorage.setItem("!cards_last_used", JSON.stringify(cardsLastUsed));
   StorageHelper.setCards(updatedCards);
}

export const LS_KEY = "reviewsStatistics_v1";

// ================== HELPERS ==================
export function loadReviewsStatistics(): ReviewStats[] {
   try {
      const raw = localStorage.getItem(LS_KEY) || "[]";
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
   } catch (e) {
      console.warn("Не удалось прочитать reviewsStatistics_v1:", e);
      return [];
   }
}

export function saveReviewsStatistics(arr: ReviewStats[]) {
   try {
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
   } catch (e) {
      console.warn("Не удалось сохранить reviewsStatistics_v1:", e);
   }
}

export function upsertStats(newEntry: ReviewStats) {
   const arr = loadReviewsStatistics();
   const idx = arr.findIndex(x => x.userId === newEntry.userId);
   if (idx >= 0) arr[idx] = { ...arr[idx], ...newEntry };
   else arr.push(newEntry);
   saveReviewsStatistics(arr);
}

export function getCardUsageData(): CardUsageMap {
   try {
      const data = localStorage.getItem(CARDS_LAST_USED);
      return data ? JSON.parse(data) : {};
   } catch (e) {
      console.error('Error reading card usage data:', e);
      return {};
   }
}

export function setCardUsageData(data: CardUsageMap): void {
   try {
      localStorage.setItem(CARDS_LAST_USED, JSON.stringify(data));
   } catch (e) {
      console.error('Error saving card usage data:', e);
   }
}

export function loadCards(): Card[] {
   const raw = localStorage.getItem("!cards");
   if (!raw) return [];

   try {
      const today = new Date();
      // JSON.parse преобразует дату в строку, поэтому нам нужно обработать это
      const cardsFromStorage: any[] = JSON.parse(raw);

      return cardsFromStorage.map((card) => {
         const cardDate = new Date(card.date);

         // Если сохраненная дата не совпадает с сегодняшним днем
         if (!isSameDay(cardDate, today)) {
            // Сбрасываем оборот и обновляем дату на текущую
            return {
               ...card,
               turnover: 0,
               date: today,
            };
         }

         // Если день тот же, просто преобразуем строку в объект Date
         return {
            ...card,
            date: cardDate,
         };
      });
   } catch (e) {
      console.error("Error loading or processing cards:", e);
      return [];
   }
}

export default reviewsStatistics;