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

// === Вспомогательная логика для проверки значимости лидера ===
function hasSignificantLead(
   candidates: { ad: Ad; card: Card; value: number }[],
   ): boolean {
   if (!candidates.length) return false;
   if (candidates.length === 1) return true; // если только одно подходящее объявление — возвращаем его
   const top = candidates[0].value;
   const second = candidates[1].value;

   // Опорные точки для интерполяции MIN_ABS_DIFF
   const hourlyThresholds: Record<number, number> = {
      0: 0.040, 1: 0.040, 2: 0.040, 3: 0.040, 4: 0.040,
      5: 0.040, 6: 0.040, 7: 0.040, 8: 0.040, 9: 0.040,
      10: 0.042, 11: 0.050, 12: 0.060, 13: 0.068, 14: 0.073,
      15: 0.076, 16: 0.078, 17: 0.079, 18: 0.080, 19: 0.077,
      20: 0.074, 21: 0.071, 22: 0.068, 23: 0.064, 24: 0.060
   };

   // Функция линейной интерполяции между опорными точками
   function interpolateThreshold(hour: number): number {
      // Нормализуем час в диапазон [0, 24]
      const h = Math.max(0, Math.min(24, hour));

      const hourFloor = Math.floor(h);
      const hourCeil = Math.ceil(h);

      // Если час целый, возвращаем точное значение
      if (hourFloor === hourCeil) {
         return hourlyThresholds[hourFloor];
      }

      // Линейная интерполяция между соседними часами
      const lowerValue = hourlyThresholds[hourFloor];
      const upperValue = hourlyThresholds[hourCeil];
      const fraction = h - hourFloor;

      return lowerValue + (upperValue - lowerValue) * fraction;
   }
   const now = new Date();
   const hour = now.getHours() + now.getMinutes() / 60;
   const MIN_ABS_DIFF = interpolateThreshold(hour);
   const REL_DIFF_FACTOR = MIN_ABS_DIFF + 0.02; // REL_DIFF_FACTOR всегда на 2% выше

   // динамический порог: берём максимум абсолютного и относительного
   const threshold = Math.max(MIN_ABS_DIFF, REL_DIFF_FACTOR * Math.max(top, second));

   const absDiff = top - second;
   if (absDiff < threshold) {
      // топ не опережает второго достаточно сильно
      return false;
   }

   // Доп. защита: если более одного объявления находятся "в пределах порога" от лидера,
   // значит конкуренция плотная — лучше ничего не возвращать.
   let closeCount = 0;
   for (const c of candidates) {
      if (top - c.value <= threshold) closeCount++;
      if (closeCount > 1) break;
   }
   if (closeCount > 1) return false;

   // прошли все проверки — лидер значим
   return true;
}

// ==== Основная функция поиска лучшего объявления для покупки (обновлённая) ====
export function findBestBuyAd(ads: Ad[]): { ad: Ad; card: Card } | null {
   ads = ads.filter((a) => !adShouldBeFiltered(a));
   if (!ads.length) return null;

   // вычислим минимальную цену среди объявлений (нужно для priceWeight)
   const minPrice = Math.min(...ads.map((a) => parseFloat(a.price)));

   // соберём кандидатов (ad + лучшая карта под это объявление + значение)
   const candidates: { ad: Ad; card: Card; value: number }[] = [];

   for (const ad of ads) {
      const card = findBuyCard(ad, minPrice); // внутри findBuyCard происходит проверка canUseCard
      if (!card) continue;

      // compute value один раз
      const value = calculateValue(ad, card, minPrice);
      if (value <= 0) continue;

      candidates.push({ ad, card, value });
   }

   if (!candidates.length) {
      console.log("нет подходящих объявлений/карт после фильтрации");
      return null;
   }

   // сортируем по убыванию value
   candidates.sort((a, b) => b.value - a.value);

   // проверяем, достаточно ли лидер опережает второго
   const significant = hasSignificantLead(candidates);

   // КД между ордерами (чтобы не запускать часто). Если КД не прошёл — не возвращаем ничего.
   const COOLDOWN_MS = 5 * 60 * 1000; // 5 минут
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

      return null;
   }

   // Всё ок — возвращаем лучший вариант
   return { ad: candidates[0].ad, card: candidates[0].card };
}
