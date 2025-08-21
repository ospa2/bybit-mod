import { stopPhrases } from '../config.js';

export function filterRemark(description) {
    let filteredText = description;

    stopPhrases.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        filteredText = filteredText.replace(regex, '');
    });

    filteredText = filteredText.replace(/[✅📌❌🔒🎯—]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+\./g, '.')
        .replace(/\s+,/g, ',')
        .replace(/\.{2,}/g, '.')
        .trim();

    return filteredText;
}
