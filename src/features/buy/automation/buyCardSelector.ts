import { loadCards } from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { adShouldBeFiltered } from "../../../shared/utils/adFilter";
import { calculateValue, canUseCard } from "./adFinder";

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
   const COOLDOWN_MS = 5 * 60 * 1000; // 5 минут


   const lastTime = Number(
      localStorage.getItem("tradingModalCooldown") || "0"
   );
   const now = Date.now();

   if ((now - lastTime >= COOLDOWN_MS) && best) {

      return { ad: best.ad, card: best.card };

   } else {
      const remainingMs = COOLDOWN_MS - (now - lastTime);
      const minutes = Math.floor(remainingMs / 1000 / 60);
      const seconds = Math.floor((remainingMs / 1000) % 60);
      if (!best) console.log(`нет подходящих карт`);
      if (remainingMs > 0) console.log(
         `КД ещё не прошло (осталось ${minutes} мин ${seconds} сек)`
      );
      return null;
   }
}