//src/logic/adFilter.js 
 
import { forbiddenPhrases, MIN_EXECUTED_COUNT, MAX_PRICE_DIFFERENCE } from '../config.js';
import { appState } from '../state.js';

export function adShouldBeFiltered(ad) {
    if (parseInt(ad.finishNum) <= MIN_EXECUTED_COUNT) return true;
    
    //if (parseFloat(ad.price) > 87) return true;
    if (ad.payments.includes('593')) return true;
    let storedStats = [];
    try {
        const raw = localStorage.getItem('reviewsStatistics_v1');
        storedStats = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(storedStats)) storedStats = [];
    } catch (err) {
        console.warn('Не удалось прочитать reviewsStatistics_v1 из localStorage:', err);
        storedStats = [];
    }
    if(storedStats.flatMap(item => item.userId).includes(ad.userId) && storedStats.find(item => item.userId === ad.userId).highlightedCount>=5) {
        return true
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
