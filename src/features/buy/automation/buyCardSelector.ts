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
   candidates: { ad: Ad; card: Card; value: number }[]
): boolean {
   if (!candidates.length) return false;
   if (candidates.length === 1) return true; // если только одно подходящее объявление — возвращаем его
   const top = candidates[0].value;
   const second = candidates[1].value;

   // Пороговые параметры (можно подстроить):
   const MIN_ABS_DIFF = 0.03; // минимальная абсолютная разница в score (3%)
   const REL_DIFF_FACTOR = 0.05; // минимальная относительная разница (5%)

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
      // Лидер не убедителен — логируем причину и ничего не возвращаем
      const top = candidates[0].value;
      const second = candidates[1] ? candidates[1].value : null;
      console.log(
         `Лидер не достаточно явно опережает конкурентов. top=${top.toFixed(
            4
         )}, second=${second !== null ? second.toFixed(4) : "n/a"}`
      );
      return null;
   }

   // Всё ок — возвращаем лучший вариант
   return { ad: candidates[0].ad, card: candidates[0].card };
}
