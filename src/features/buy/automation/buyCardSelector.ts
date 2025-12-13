import { loadCards } from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { adShouldBeFiltered } from "../../../shared/utils/adFilter";
import { calculateValue, canUseCard, paymentWeight } from "./adFinder";

// ======== Выбор карты для покупки ========
// НОВАЯ функция - абсолютный фильтр качества
function meetsMinimumQuality(ad: Ad, card: Card, minPrice: number): boolean {
   const price = parseFloat(ad.price);
   const amount = parseFloat(ad.maxAmount);

   // Жёсткие требования
   const MAX_PRICE_TOLERANCE = 0.005; // 0.5%
   const MIN_ACCEPTABLE_AMOUNT = 30000; // 30k

   // Проверка цены
   if (price > minPrice * (1 + MAX_PRICE_TOLERANCE)) {
      return false;
   }

   // Проверка объёма
   if (amount < MIN_ACCEPTABLE_AMOUNT) {
      return false;
   }

   // Проверка способа оплаты
   if (paymentWeight(ad, card) === 0) {
      return false;
   }

   return true;
}
export function findBuyCard(ad: Ad, minPrice: number): Card | null {
   const cards = loadCards();
   if (!cards.length) return null;

   let best: { card: Card; value: number } | null = null;

   for (const card of cards) {
      if (!canUseCard(card, ad)) continue;

      // НОВАЯ ПРОВЕРКА: фильтруем заведомо плохие объявления
      if (!meetsMinimumQuality(ad, card, minPrice)) continue;

      const value = calculateValue(ad, card, minPrice);
      if (value <= 0) continue;

      if (!best || value > best.value) {
         best = { card, value };
      }
   }

   return best ? best.card : null;
}

function hasSignificantLead(
   candidates: { ad: Ad; card: Card; value: number }[],
): boolean {
   if (!candidates.length) return false;
   if (candidates.length === 1) return true;

   const top = candidates[0].value;
   const second = candidates[1].value;

   // БОЛЕЕ СТРОГИЕ ПОРОГИ
   const hourlyThresholds: Record<number, number> = {
      0: 0.050, 1: 0.050, 2: 0.050, 3: 0.050, 4: 0.050,
      5: 0.050, 6: 0.050, 7: 0.050, 8: 0.055, 9: 0.060,
      10: 0.065, 11: 0.075, 12: 0.085, 13: 0.095, 14: 0.100,
      15: 0.105, 16: 0.110, 17: 0.112, 18: 0.115, 19: 0.110,
      20: 0.105, 21: 0.095, 22: 0.085, 23: 0.075, 24: 0.065
   };

   function interpolateThreshold(hour: number): number {
      const h = Math.max(0, Math.min(24, hour));
      const hourFloor = Math.floor(h);
      const hourCeil = Math.ceil(h);

      if (hourFloor === hourCeil) {
         return hourlyThresholds[hourFloor];
      }

      const lowerValue = hourlyThresholds[hourFloor];
      const upperValue = hourlyThresholds[hourCeil];
      const fraction = h - hourFloor;

      return lowerValue + (upperValue - lowerValue) * fraction;
   }

   const now = new Date();
   const hour = now.getHours() + now.getMinutes() / 60;
   const dayOfWeek = now.getDay();

   let MIN_ABS_DIFF = interpolateThreshold(hour);

   if (dayOfWeek === 6 || dayOfWeek === 0) {
      MIN_ABS_DIFF = 0.050; // Выходные
   }

   const REL_DIFF_FACTOR = MIN_ABS_DIFF + 0.03;

   const threshold = Math.max(MIN_ABS_DIFF, REL_DIFF_FACTOR * Math.max(top, second));

   const absDiff = top - second;
   if (absDiff < threshold) {
      return false;
   }

   // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: лидер должен иметь минимальное абсолютное значение
   const MIN_ABSOLUTE_VALUE = 0.45; // Минимальный score для победителя
   if (top < MIN_ABSOLUTE_VALUE) {
      console.log(`Лидер отклонён: value ${top.toFixed(3)} < ${MIN_ABSOLUTE_VALUE}`);
      return false;
   }

   let closeCount = 0;
   for (const c of candidates) {
      if (top - c.value <= threshold) closeCount++;
      if (closeCount > 1) break;
   }
   if (closeCount > 1) return false;

   return true;
}

export function findBestBuyAd(ads: Ad[]): { ad: Ad; card: Card } | null {
   ads = ads.filter((a) => !adShouldBeFiltered(a));
   if (!ads.length) return null;

   const minPrice = Math.min(...ads.map((a) => parseFloat(a.price)));

   const candidates: { ad: Ad; card: Card; value: number }[] = [];

   for (const ad of ads) {
      const card = findBuyCard(ad, minPrice);
      if (!card) continue;

      const value = calculateValue(ad, card, minPrice);
      if (value <= 0) continue;

      candidates.push({ ad, card, value });
   }

   if (!candidates.length) {
      console.log("Нет объявлений, соответствующих строгим критериям качества");
      return null;
   }

   candidates.sort((a, b) => b.value - a.value);

   // Логируем топ-3 для отладки
   console.log("=== ТОП-3 КАНДИДАТОВ ===");
   candidates.slice(0, 3).forEach((c, i) => {
      const price = parseFloat(c.ad.price);
      const amount = parseFloat(c.ad.maxAmount);
      const priceVsMin = ((price / minPrice - 1) * 100).toFixed(2);
      console.log(`${i + 1}. Value: ${c.value.toFixed(3)} | Price: ${price} (+${priceVsMin}%) | Amount: ${amount} | Bank: ${c.card.bank}`);
   });

   const significant = hasSignificantLead(candidates);

   const COOLDOWN_MS = 5 * 60 * 1000;
   const lastTime = Number(localStorage.getItem("tradingModalCooldown") || "0");
   const now = Date.now();

   if (now - lastTime < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (now - lastTime);
      const minutes = Math.floor(remainingMs / 1000 / 60);
      const seconds = Math.floor((remainingMs / 1000) % 60);
      console.log(`КД ещё не прошло (осталось ${minutes} мин ${seconds} сек)`);
      return null;
   }

   if (!significant) {
      console.log("Лидер не имеет значительного преимущества");
      return null;
   }

   const winner = candidates[0];
   console.log(`✅ ВЫБРАНО: Price ${parseFloat(winner.ad.price)} | Amount ${parseFloat(winner.ad.maxAmount)} | Value ${winner.value.toFixed(3)}`);

   return winner;
}