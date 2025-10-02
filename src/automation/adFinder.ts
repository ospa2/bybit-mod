import type { OrderPayload } from "../components/buyModal";
import { adShouldBeFiltered } from "../logic/adFilter";
import type { Ad } from "../types/ads";

export interface Card {
   id: string;
   bank: "tbank" | "sber";
   balance: number; // остаток
   turnover: number; // оборот за сегодня
   date: Date; // дата последнего обновления оборота
}

// ==== Helpers для localStorage ====

function isSameDay(date1: Date | string | number, date2: Date | string | number): boolean {
   const d1 = date1 instanceof Date ? date1 : new Date(date1);
   const d2 = date2 instanceof Date ? date2 : new Date(date2);

   return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
   );
}


function loadCards(): Card[] {
   const raw = localStorage.getItem("cards_v1");
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


// ==== Весовые функции ====
function priceWeight(price: number, minPrice: number): number {
   if (price <= minPrice) {
      return 1.0;
   } else if (price <= minPrice * 1.005) {
      // линейная интерполяция от 1 до 0.5
      return 0.5 + ((1.0 - 0.5) * (1.005 - price / minPrice)) / 0.005;
   } else if (price <= minPrice * 1.01) {
      // линейная интерполяция от 0.5 до 0.3
      return 0.3 + ((0.5 - 0.3) * (1.01 - price / minPrice)) / 0.005;
   } else {
      return 0.3;
   }
}

function amountWeight(amount: number): number {
   if (amount <= 10000) return 1.0;
   if (amount <= 20000) return 1.0 + ((1.4 - 1.0) * (amount - 10000)) / 10000;
   if (amount <= 30000) return 1.4 + ((1.7 - 1.4) * (amount - 20000)) / 10000;
   if (amount <= 40000) return 1.7 + ((2.0 - 1.7) * (amount - 30000)) / 10000;
   return 2.0;
}

function paymentWeight(ad: Ad, card: Card): number {
   const sberIds = ["377", "582", "584", "585"];
   const isSberAd = ad.payments.some((id) => sberIds.includes(id));
   const cardsTbankBalances = loadCards().filter((c) => c.bank === "tbank").map((c) => c.balance);
   const cardsSberBalances = loadCards()
      .filter((c) => c.bank === "sber")
      .map((c) => c.balance);
   //если баланс тбанков опустошен, а сберов - нет
   if (
      cardsTbankBalances.every((balance) => balance <= 20000) &&
      cardsSberBalances.some((balance) => balance >= 20000) &&
      card.bank === "sber" &&
      isSberAd
   ){
      return 12.0;
   }
   

   

   if (card.bank === "sber" && isSberAd) return 1.0;
   if (card.bank === "tbank" && !isSberAd) return 0.8;

   return 0; // карта не подходит под способы оплаты
}

// ==== Проверка карты ====
function canUseCard(card: Card, ad: Ad): boolean {
   const maxAmount = parseFloat(ad.maxAmount);

   
   if (isNaN(maxAmount)) return false;

   if (card.balance - maxAmount < 10_000) return false;
   if (card.turnover + maxAmount > 100_000) return false;
   
   return paymentWeight(ad, card) > 0;
}

const LAST_USED_KEY = "lastUsedCardId";

// ======== Выбор карты для продажи ========

export function findSellCard(ad: OrderPayload): Card | null {
   const maxAmount = parseFloat(ad.amount);
   const today = new Date();

   // Загружаем все карты
   let cards: Card[] = JSON.parse(localStorage.getItem("cards_v1") || "[]");

   if (!cards.length) return null;

   // Обновляем turnover, если новый день
   cards = cards.map((c) => {
      if (!isSameDay(c.date, today)) {
         return { ...c, turnover: 0, lastUpdated: today };
      }
      return c;
   });

   // Фильтруем подходящие карты
   const available = cards.filter((c) => c.turnover + maxAmount < 100000);

   if (!available.length) return null;

   // Сортировка по приоритету банка
   available.sort((a, b) => {
      const priority = (bank: string) =>
         bank.toLowerCase().includes("tbank")
            ? 1
            : bank.toLowerCase().includes("sber")
            ? 2
            : 3;
      return priority(a.bank) - priority(b.bank);
   });

   // Учитываем, чтобы карта не повторялась подряд
   const lastUsed = localStorage.getItem(LAST_USED_KEY);
   let bestCard = available[0];

   if (lastUsed && available.length > 1 && available[0].id === lastUsed) {
      // если первая карта совпадает с прошлой — берём следующую
      bestCard = available[1];
   }

   // Запоминаем выбранную карту
   localStorage.setItem(LAST_USED_KEY, bestCard.id);

   // Обновляем cards_v1 (сброс turnover при новом дне)
   localStorage.setItem("cards_v1", JSON.stringify(cards));

   return bestCard;
}

// ==== Основная функция ====
function calculateValue(ad: Ad, card: Card, minPrice: number): number {
   const price = parseFloat(ad.price);
   const amount = parseFloat(ad.maxAmount);

   const wPrice = priceWeight(price, minPrice);
   const wAmount = amountWeight(amount);
   const wPayment = paymentWeight(ad, card);
   

   // веса факторов
   const priceCoef = 0.6;
   const paymentCoef = 0.25;
   const amountCoef = 0.15;
   // console.log(
   //    wPrice * priceCoef + wPayment * paymentCoef + wAmount * amountCoef
   // );
   
   return wPrice * priceCoef + wPayment * paymentCoef + wAmount * amountCoef;
}

// ======== Выбор карты для покупки ========
export function findBuyCard(ad: Ad, minPrice: number): Card | null {
   const cards = loadCards();
   if (!cards.length) return null;

   let best: { card: Card; value: number } | null = null;

   for (const card of cards) {
      if (!canUseCard(card, ad)) continue;

      const value = calculateValue(ad, card, minPrice);
      if (value <= 0) continue;

      if (!best || value > best.value) {
         best = { card, value };
      }
   }

   return best ? best.card : null;
}

// ==== Основная функция ====
export function findBestBuyAd(ads: Ad[]): { ad: Ad; card: Card } | null {
   let cards = loadCards();
   if (!ads.length || !cards.length) return null;

   ads = ads.filter((a) => !adShouldBeFiltered(a));
   if (!ads.length) return null;

   const minPrice = Math.min(...ads.map((a) => parseFloat(a.price)));
   let best: { ad: Ad; card: Card; value: number } | null = null;

   for (const ad of ads) {
      const card = findBuyCard(ad, minPrice);
      if (!card) continue;

      const value = calculateValue(ad, card, minPrice);

      if (!best || value > best.value) {
         best = { ad, card, value };
      }
   }

   if (best) {
      console.log("best:", best.ad.remark);
      return { ad: best.ad, card: best.card };
   }

   return null;
}