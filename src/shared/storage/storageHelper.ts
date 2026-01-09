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

export function upsertStatsBatch(newEntries: ReviewStats[]) {
   if (!newEntries || newEntries.length === 0) return;

   const arr = loadReviewsStatistics();

   // Создаем Map для мгновенного поиска O(1)
   const statsMap = new Map(arr.map(item => [item.userId, item]));

   let hasChanges = false;

   for (const entry of newEntries) {
      const existing = statsMap.get(entry.userId);

      // Глубокое сравнение здесь избыточно, но можно проверить, 
      // изменились ли данные, чтобы не перезаписывать Storage вхолостую
      if (existing) {
         // Обновляем существующую запись
         statsMap.set(entry.userId, { ...existing, ...entry });
         hasChanges = true;
      } else {
         // Добавляем новую
         statsMap.set(entry.userId, entry);
         hasChanges = true;
      }
   }

   if (hasChanges) {
      saveReviewsStatistics(Array.from(statsMap.values()));
   }
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
      const cardsFromStorage: Card[] = JSON.parse(raw);

      // Проверяем, нужно ли сбросить оборот для всех карт
      if (shouldResetTurnover()) {
         return cardsFromStorage.map((card) => ({
            ...card,
            turnover: 0,
         }));
      }

      // Если сброс не требуется, просто возвращаем карты с восстановленными датами
      return cardsFromStorage.map((card) => ({
         ...card
      }));
   } catch (e) {
      console.error("Error loading or processing cards:", e);
      return [];
   }
}

function shouldResetTurnover(): boolean {
   const raw = localStorage.getItem("!cards_last_used");
   if (!raw) return false;

   try {
      const lastUsedTimes: Record<string, number> = JSON.parse(raw);
      const timestamps = Object.values(lastUsedTimes);

      if (timestamps.length === 0) return false;

      // Находим максимальный timestamp
      const maxTimestamp = Math.max(...timestamps);
      const lastUsedDate = new Date(maxTimestamp);
      const today = new Date();

      // Проверяем, было ли последнее использование не сегодня
      return !isSameDay(lastUsedDate, today);
   } catch (e) {
      console.error("Error checking last used times:", e);
      return false;
   }
}

export default reviewsStatistics;