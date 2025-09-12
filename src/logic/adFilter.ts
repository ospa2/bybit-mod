//src/logic/adFilter.ts 
 
import { forbiddenPhrases, MIN_EXECUTED_COUNT, MAX_PRICE_DIFFERENCE } from '../config.ts';
import { appState } from '../state.ts';
import { GM_getValue } from '$';
import type { Ad } from '../types/ads';
import type { ReviewStats } from '../types/reviews';

export function adShouldBeFiltered(ad: Ad) {
    if (ad.finishNum <= MIN_EXECUTED_COUNT) return true;
    
    //if (parseFloat(ad.price) > 87) return true;
    if (ad.payments.includes('593')) return true;
    let storedStats: ReviewStats[] = [];
    try {
      storedStats = GM_getValue("reviewsStatistics_v1", []);
      if (!Array.isArray(storedStats)) storedStats = [];
    } catch (err) {
      console.warn(
        "Не удалось прочитать reviewsStatistics_v1 из GM-хранилища:",
        err
      );
      storedStats = [];
    }

    const userStats = storedStats.find(item => item.userId === ad.userId);
    
    if(userStats && userStats.highlightedCount >= 3) {
        return true;
    }
    const min = parseFloat(ad.minAmount);
    const max = parseFloat(ad.maxAmount);
    const diff = max - min;

    if (isNaN(min) || isNaN(max)) return true;
    if (diff > MAX_PRICE_DIFFERENCE) return true;

    // 🚀 фильтрация только если диапазон вообще не пересекается с допустимым интервалом
    if (max < appState.MIN_LEFT_VALUE || min > appState.MAX_RIGHT_VALUE) return true;

    if (ad.remark && typeof ad.remark === 'string') {
        const remark = ad.remark.toLowerCase();
        for (const phrase of forbiddenPhrases) {
            if (remark.includes(phrase)) return true;
        }
    }
    return false;
}
