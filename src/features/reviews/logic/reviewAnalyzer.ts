import { KEYWORDS_TO_HIDE, KEYWORDS_TO_HIGHLIGHT } from "../../../core/config";

export interface ReviewAnalysis {
  shouldHide: boolean;
  shouldHighlight: boolean;
}

export function analyzeReview(reviewText: string | null | undefined): ReviewAnalysis {
  if (!reviewText) return { shouldHide: false, shouldHighlight: false };

  let shouldHide = false;
  let shouldHighlight = false;

  const searchText = reviewText.toLowerCase();

  // Проверяем ключевые слова для скрытия
  for (const keyword of KEYWORDS_TO_HIDE) {
    if (keyword.trim() !== "" && searchText === keyword.toLowerCase()) {
      shouldHide = true;
    }
  }

  // Скрываем слишком короткие отзывы
  if (reviewText.length < 50) shouldHide = true;

  // Список "спам"-слов
  const spamKeywords = [
    "медленный",
    "грубый",
    "просит оплатить дополнительные комиссии",
    "нетерпеливый",
    "slow",
    "rude",
    "asks for additional fees",
    "impatient",
  ];

  // Разбиваем текст по запятым
  const textFragments = searchText.split(",").map((f) => f.trim());

  let isSpamReview = textFragments.length > 0;
  let spamKeywordCount = 0;

  for (const fragment of textFragments) {
    if (!fragment) continue;
    const isSpamFragment = spamKeywords.some((spam) => fragment === spam.toLowerCase());
    if (isSpamFragment) {
      spamKeywordCount++;
    } else {
      isSpamReview = false;
    }
  }

  if (isSpamReview && spamKeywordCount >= 2) shouldHide = true;

  // Проверяем ключевые слова для подсветки
  for (const keyword of KEYWORDS_TO_HIGHLIGHT) {
    if (keyword.trim() !== "" && searchText.includes(keyword.toLowerCase())) {
      shouldHighlight = true;
      shouldHide = false; // подсветка имеет приоритет
    }
  }

  return { shouldHide, shouldHighlight };
}
