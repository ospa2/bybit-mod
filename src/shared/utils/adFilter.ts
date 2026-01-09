//src/logic/adFilter.ts 

import { forbiddenPhrases, MIN_EXECUTED_COUNT, } from '../../core/config.ts';
import { appState } from '../../core/state.ts';
import type { Ad } from '../types/ads';
import type { ReviewStats } from '../types/reviews';
import { availableBanks } from './bankParser.ts';

// side == 1 - покупка
export function adShouldBeFiltered(ad: Ad) {
  // 1. Фильтрация по минимальному количеству выполненных объявлений
  if (ad.finishNum <= MIN_EXECUTED_COUNT && ad.side === 0) {

    return true;
  }
  const isOnlySber = localStorage.getItem("onlySber") === "true";

  const banks = availableBanks(ad.remark);
  if (isOnlySber && !banks.includes("Сбербанк") && !banks.includes("*")) {
    return true;
  }

  let storedStats: ReviewStats[] = [];
  try {


    // 2. Фильтрация для стороны ad.side === 0 по количеству хороших отзывов
    if (ad.side === 0) {
      const storedStatsRaw = localStorage.getItem("reviewsStatistics_v1");
      storedStats = storedStatsRaw ? JSON.parse(storedStatsRaw) : [];
      const userStats = storedStats.find((item) => item.userId === ad.userId);
      const goodReviewsCount = userStats?.goodReviewsCount ?? 0;
      if (goodReviewsCount < 100) {
        return true;
      }

    }
    // Проверка на корректность типа после получения из хранилища (если понадобится)
    if (!Array.isArray(storedStats)) storedStats = [];
  } catch (err) {

    storedStats = []; // Сброс в пустой массив при ошибке
  }

  const userStats = storedStats.find(item => item.userId === ad.userId);

  // 3. Фильтрация по количеству подсвеченных (highlighted) объявлений
  if (userStats && userStats.highlightedCount >= 3 && ad.side === 0) {

    return true;
  }

  const min = parseFloat(ad.minAmount);
  const max = parseFloat(ad.maxAmount);
  // const diff = max - min;

  // 4. Фильтрация, если min/maxAmount не являются числами
  if (isNaN(min) || isNaN(max)) {

    return true;
  }

  // 5. Фильтрация по максимальной разнице в цене
  // if (diff > MAX_PRICE_DIFFERENCE) {

  //   return true;
  // }

  // 6. Фильтрация по пересечению диапазона с допустимым интервалом
  // 🚀 фильтрация только если диапазон вообще не пересекается с допустимым интервалом
  if (max < appState.MIN_LEFT_VALUE || min > appState.MAX_RIGHT_VALUE) {

    return true;
  }

  // 7. Фильтрация по запрещенным фразам в примечании (remark)
  if (ad.remark && typeof ad.remark === 'string') {
    const remark = ad.remark.toLowerCase();
    for (const phrase of forbiddenPhrases) {
      if (typeof phrase === 'string') {
        if (remark.includes(phrase)) {
          return true;
        }
      } else if (phrase instanceof RegExp) {
        if (phrase.test(remark)) {
          return true;
        }
      }
    }
  }

  // Если объявление прошло все проверки
  return false;
}
