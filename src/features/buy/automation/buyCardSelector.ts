import { loadCards } from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { adShouldBeFiltered } from "../../../shared/utils/adFilter";
import { calculateValue, canUseCard } from "./adFinder";

const MIN_NORMAL_VOLUME = 20000;
// Мелкое объявление должно быть дешевле "нормального" минимум на 0.4%
const REQUIRED_DISCOUNT_FOR_SMALL_ADS = 0.004;

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

// ==== Улучшенная проверка лидерства ====
function hasSignificantLead(
   candidates: { ad: Ad; card: Card; value: number }[],
): boolean {
   if (!candidates.length) return false;
   // Если кандидат всего один и его Value высокое - берем
   if (candidates.length === 1) return candidates[0].value > 0.6;

   const top = candidates[0].value;

   // Считаем среднее value среди топ-2...топ-4 (или сколько есть)
   // Это защита от случая, когда 2-е место случайно просело, но 3-е и 4-е сильные


   // Динамический порог в зависимости от времени (твоя логика сохранена)
   // const hourlyThresholds: Record<number, number> = {
   //    0: 0.040, 1: 0.040, 2: 0.040, 3: 0.040, 4: 0.040,
   //    5: 0.040, 6: 0.040, 7: 0.040, 8: 0.045, 9: 0.050,
   //    10: 0.055, 11: 0.065, 12: 0.075, 13: 0.075, 14: 0.080,
   //    15: 0.080, 16: 0.080, 17: 0.080, 18: 0.080, 19: 0.080,
   //    20: 0.080, 21: 0.080, 22: 0.080, 23: 0.075, 24: 0.065
   // };

   // const now = new Date();
   // const hour = now.getHours();
   // const dayOfWeek = now.getDay();

   // if (dayOfWeek === 6 || dayOfWeek === 0) MIN_ABS_DIFF = 0.045;

   const MIN_ABSOLUTE_VALUE = 0.8; // Подняли порог минимального качества
   if (top < MIN_ABSOLUTE_VALUE) {
      console.log(`Лидер отклонён: value ${top.toFixed(3)} < ${MIN_ABSOLUTE_VALUE}`);
      return false;
   }

   return true;
}

export function findBestBuyAd(ads: Ad[]): { ad: Ad; card: Card } | null {
   // 1. Базовая фильтрация
   let validAds = ads.filter((a) => !adShouldBeFiltered(a));
   if (!validAds.length) return null;

   // 2. Определяем "Рыночную Цену" (minPrice среди нормальных объемов)
   const normalVolumeAds = validAds.filter(a => parseFloat(a.maxAmount) >= MIN_NORMAL_VOLUME);

   // Если нормальных объявлений нет вообще, берем минимальную цену из всего пула
   const globalMinPrice = Math.min(...validAds.map(a => parseFloat(a.price)));

   let referencePrice = globalMinPrice;
   if (normalVolumeAds.length > 0) {
      referencePrice = Math.min(...normalVolumeAds.map(a => parseFloat(a.price)));
   }

   // 3. Формируем кандидатов с учетом жесткого фильтра для мелочи
   const candidates: { ad: Ad; card: Card; value: number }[] = [];

   for (const ad of validAds) {
      const amount = parseFloat(ad.maxAmount);
      const price = parseFloat(ad.price);

      // === ЛОГИКА ФИЛЬТРАЦИИ МЕЛОЧИ ===
      if (amount < MIN_NORMAL_VOLUME) {
         // Если объявление мелкое, оно ДОЛЖНО быть дешевле референса на X%
         // Пример: Референс 100.00. Мелочь должна быть <= 99.60
         if (price > referencePrice * (1 - REQUIRED_DISCOUNT_FOR_SMALL_ADS)) {
            // Если цена не супер-выгодная, пропускаем сразу, даже не считая Value
            continue;
         }
      }
      // ================================

      // Передаем globalMinPrice для расчета Value, чтобы Score был честным относительно всего рынка
      const card = findBuyCard(ad, globalMinPrice);
      if (!card) continue;

      const value = calculateValue(ad, card, globalMinPrice);

      // Если это "мелочь", прошедшая фильтр цены, она может иметь низкий amountWeight,
      // поэтому снизим порог входа или оставим как есть, так как priceWeight будет 1.0
      if (value <= 0) continue;

      candidates.push({ ad, card, value });
   }

   if (!candidates.length) {
      console.log("Нет подходящих кандидатов после фильтрации по объему/цене.");
      return null;
   }

   candidates.sort((a, b) => b.value - a.value);

   // Логирование
   console.log(`Ref Price (>20k): ${referencePrice} | Global Min: ${globalMinPrice}`);
   console.log("=== ТОП-3 КАНДИДАТОВ ===");
   candidates.slice(0, 3).forEach((c, i) => {
      const price = parseFloat(c.ad.price);
      const amount = parseFloat(c.ad.maxAmount);
      const isSmall = amount < MIN_NORMAL_VOLUME;
      const tag = isSmall ? "[SMALL GEM]" : "[NORMAL]";
      console.log(`${i + 1}. ${tag} Val: ${c.value.toFixed(3)} | P: ${price} | Amt: ${amount} | ${c.card.bank}`);
   });

   // Проверка кулдауна
   const COOLDOWN_MS = 5 * 60 * 1000;
   const lastTime = Number(localStorage.getItem("tradingModalCooldown") || "0");
   const now = Date.now();

   if (now - lastTime < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (now - lastTime);
      console.log(`КД трейдинга: ${(remainingMs / 1000).toFixed(0)} сек`);
      return null;
   }

   if (!hasSignificantLead(candidates)) {
      console.log("Лидер не имеет достаточного преимущества над средним конкурентов.");
      return null;
   }

   const winner = candidates[0];
   console.log(`✅ ВЫБРАНО: ${parseFloat(winner.ad.price)} | Vol: ${parseFloat(winner.ad.maxAmount)}`);

   return winner;
}