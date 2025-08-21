import { KEYWORDS_TO_HIDE, KEYWORDS_TO_HIGHLIGHT, spamKeywords } from '../config';


export function analyzeReview(reviewText) {
    if (!reviewText) return { shouldHide: false, shouldHighlight: false };

    let shouldHide = false;
    let shouldHighlight = false;

    const searchText = reviewText.toLowerCase();

    // Проверяем каждое ключевое слово для скрытия (полное совпадение)
    KEYWORDS_TO_HIDE.forEach(keyword => {
        if (keyword.trim() === '') return;
        
        const searchKeyword = keyword.toLowerCase();
        
        if (searchText === searchKeyword) {
            shouldHide = true;
        }
    });

    // Разбиваем текст на фрагменты по запятым и очищаем пробелы
    const textFragments = searchText.split(',').map(fragment => fragment.trim());

    // Проверяем, содержит ли отзыв только спам-ключевые слова
    let isSpamReview = textFragments.length > 0;
    for (let fragment of textFragments) {
        if (fragment === '') continue;
        
        let isSpamFragment = false;
        for (let spamKeyword of spamKeywords) {
            const searchSpamKeyword = spamKeyword.toLowerCase();
            if (fragment === searchSpamKeyword) {
                isSpamFragment = true;
                break;
            }
        }
        
        if (!isSpamFragment) {
            isSpamReview = false;
            break;
        }
    }

    // Дополнительно проверяем, что есть хотя бы 2 спам-ключевых слова
    let spamKeywordCount = 0;
    for (let fragment of textFragments) {
        if (fragment === '') continue;
        
        for (let spamKeyword of spamKeywords) {
            const searchSpamKeyword = spamKeyword.toLowerCase();
            if (fragment === searchSpamKeyword) {
                spamKeywordCount++;
                break;
            }
        }
    }

    if (isSpamReview && spamKeywordCount >= 2) {
        shouldHide = true;
    }

    // Проверяем ключевые слова для подсветки (частичное совпадение)
    KEYWORDS_TO_HIGHLIGHT.forEach(keyword => {
        if (keyword.trim() === '') return;
        
        const searchKeyword = keyword.toLowerCase();
        
        if (searchText.includes(searchKeyword)) {
            shouldHighlight = true;
        }
    });

    return { shouldHide, shouldHighlight };
}