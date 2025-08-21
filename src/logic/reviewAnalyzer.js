import { KEYWORDS_TO_HIGHLIGHT, KEYWORDS_TO_HIDE } from '../config.js';

export function analyzeReview(reviewText) {
    if (!reviewText) return { shouldHide: false, shouldHighlight: false };

    let shouldHide = false;
    let shouldHighlight = false;

    const searchText = reviewText.toLowerCase();

    KEYWORDS_TO_HIDE.forEach(keyword => {
        if (keyword.trim() !== '' && searchText === keyword.toLowerCase()) {
            shouldHide = true;
        }
    });

    const spamKeywords = ['медленный', 'грубый', 'просит оплатить дополнительные комиссии','нетерпеливый','slow','rude','asks for additional fees','impatient'];

    const textFragments = searchText.split(',').map(f => f.trim());

    let isSpamReview = textFragments.length > 0;
    let spamKeywordCount = 0;

    for (let fragment of textFragments) {
        if (fragment === '') continue;
        let isSpamFragment = spamKeywords.some(spam => fragment === spam.toLowerCase());
        if (isSpamFragment) spamKeywordCount++; else isSpamReview = false;
    }

    if (isSpamReview && spamKeywordCount >= 2) shouldHide = true;

    KEYWORDS_TO_HIGHLIGHT.forEach(keyword => {
        if (keyword.trim() !== '' && searchText.includes(keyword.toLowerCase())) {
            shouldHighlight = true;
        }
    });

    return { shouldHide, shouldHighlight };
}
