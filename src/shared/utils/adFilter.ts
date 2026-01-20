//src/logic/adFilter.ts 

import { forbiddenPhrases, MIN_EXECUTED_COUNT, } from '../../core/config.ts';
import { appState } from '../../core/state.ts';
import type { Ad } from '../types/ads';
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
