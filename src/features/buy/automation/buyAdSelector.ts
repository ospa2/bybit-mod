import type { Ad } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { calculateValue, findBuyCard, getContextAwareReferencePrice } from "./cardFinder";

const MIN_NORMAL_VOLUME = 20000;
// Мелкое объявление должно быть дешевле "нормального" минимум на 0.4%
const REQUIRED_DISCOUNT_FOR_SMALL_ADS = 0.004;

// ==== Улучшенная проверка лидерства ====
function hasSignificantLead(
   candidates: { ad: Ad; card: Card; value: number }[],
): boolean {
   if (!candidates.length) return false;
   // Если кандидат всего один и его Value высокое - берем
   if (candidates.length === 1) return candidates[0].value > 0.6;

   const top = candidates[0].value;


   const MIN_ABSOLUTE_VALUE = 0.8; // Подняли порог минимального качества
   if (top < MIN_ABSOLUTE_VALUE) {
      return false;
   }

   return true;
}

export function findBestBuyAd(ads: Ad[]): { ad: Ad; card: Card } | null {
   // 1. Предварительная фильтрация (можно добавить, если нужно)

   // 2. Определяем ТЕКУЩУЮ "Рыночную Цену" (minPrice среди нормальных объемов)
   const normalVolumeAds = ads.filter(a => parseFloat(a.maxAmount) >= MIN_NORMAL_VOLUME);

   // Если нормальных объявлений нет, берем минимум из всего пула
   const globalMinPrice = Math.min(...ads.map(a => parseFloat(a.price)));

   let currentMarketPrice = globalMinPrice;
   if (normalVolumeAds.length > 0) {
      currentMarketPrice = Math.min(...normalVolumeAds.map(a => parseFloat(a.price)));
   }

   // === ИНТЕГРАЦИЯ КОНТЕКСТА ===
   // Получаем цену с учетом времени суток.
   // Если сейчас день/вечер, эта переменная вернет среднюю утреннюю цену.
   const targetReferencePrice = getContextAwareReferencePrice(currentMarketPrice);
   // ============================

   // 3. Формируем кандидатов
   const candidates: { ad: Ad; card: Card; value: number }[] = [];

   for (const ad of ads) {
      const amount = parseFloat(ad.maxAmount);
      const price = parseFloat(ad.price);

      // === ЛОГИКА ФИЛЬТРАЦИИ МЕЛОЧИ ===
      if (amount < MIN_NORMAL_VOLUME) {
         // Сравниваем с targetReferencePrice (утренней ценой днем)
         if (price > targetReferencePrice * (1 - REQUIRED_DISCOUNT_FOR_SMALL_ADS)) {
            continue;
         }
      }
      // ================================

      const card = findBuyCard(ad, targetReferencePrice);
      if (!card) continue;

      // Считаем Value относительно целевой (утренней) цены
      const value = calculateValue(ad, card, targetReferencePrice);

      if (value <= 0) continue;

      candidates.push({ ad, card, value });
   }

   if (!candidates.length) {
      // Можно добавить лог, чтобы понимать, что фильтрация работает
      // console.log(`Кандидаты отсеяны по цене > ${targetReferencePrice}`);
      return null;
   }

   candidates.sort((a, b) => {
      // 1. Приоритет по value (по убыванию)
      if (b.value !== a.value) {
         return b.value - a.value;
      }

      // 2. Если value одинаковы, значит карты одного банка. выбираем карту у которой баланс больше
      const balanceA = a.card?.balance ?? 0;
      const balanceB = b.card?.balance ?? 0;

      return balanceB - balanceA;
   });


   // Передаем кандидатов в проверку лидерства
   // (Примечание: hasSignificantLead использует абсолютные значения value, 
   // которые теперь будут занижены для дорогих вечерних объявлений, что нам и нужно)
   if (!hasSignificantLead(candidates)) {
      return null;
   }

   const winner = candidates[0];
   console.log(`✅ ВЫБРАНО (Ref: ${targetReferencePrice.toFixed(2)}): ${parseFloat(winner.ad.price)} | Vol: ${parseFloat(winner.ad.maxAmount)}`);
   

   return winner;
}

export { findBuyCard };
