import { forbiddenPhrases, MIN_EXECUTED_COUNT, MAX_PRICE_DIFFERENCE } from '../config.js';
import { MIN_LEFT_VALUE, MAX_RIGHT_VALUE } from '../state.js';

export function adShouldBeFiltered(ad) {
    if (parseInt(ad.finishNum) <= MIN_EXECUTED_COUNT) return true;

    const min = parseFloat(ad.minAmount);
    const max = parseFloat(ad.maxAmount);
    const diff = max - min;

    if (isNaN(min) || isNaN(max)) return true;
    if (diff > MAX_PRICE_DIFFERENCE || max >= MAX_RIGHT_VALUE || min <= MIN_LEFT_VALUE) return true;

    if (ad.remark && typeof ad.remark === 'string') {
        const remark = ad.remark.toLowerCase();
        for (const phrase of forbiddenPhrases) {
            if (remark.includes(phrase)) return true;
        }
    }
    return false;
}
