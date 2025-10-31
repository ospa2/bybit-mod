// src/shared/storage/StorageHelper.ts

import { loadCards, type Card } from "../../features/buy/automation/adFinder";
import type { OrderData } from "../types/ads";
import type { ReviewStats } from "../types/reviews";

const STORAGE_KEY = "reviewsStatistics_v1";

export const reviewsStatistics = {
   data: (function loadFromStorage(): ReviewStats[] {
      // ... (Ваша функция loadFromStorage без изменений)
      try {
         const raw = localStorage.getItem(STORAGE_KEY);
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
         localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
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
   StorageHelper.setCards(updatedCards);
}

// Восстановление баланса карты до исходного значения
export function restoreCardBalance(originalCard: Card): void {
   // originalCard - это данные карты до создания ордера
   const cards: Card[] = loadCards()
   const updatedCards = cards.map((c) =>
      c.id === originalCard.id ? { ...originalCard } : c
   );
   StorageHelper.setCards(updatedCards);
}

export default reviewsStatistics;