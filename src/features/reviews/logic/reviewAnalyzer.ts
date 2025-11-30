import { KEYWORDS_TO_HIDE } from "../../../core/config";

export interface ReviewAnalysis {
  shouldHide: boolean;
  shouldHighlight: boolean;
}

function shouldHighlight1(remark: string, debug: boolean): boolean {
  remark = remark.toLowerCase();
  const KEYWORDS_TO_HIGHLIGHT = [
    "казино",
    "казик",
    "ошибочн",
    "оспорить",
    "краденной карт",
    "меня вызвал",
    "черн",
    "чёрн",
    "скам бабк",
    "украденн",
    "деньги вернул",
    "уголов",
    "требует деньг",
    "требуют деньг",
    "заявил об мош",
    "заявил о мош",
    "ворованные деньг",
    "отозвать",
    "требовать деньг",
    "отказал в обсл",
    "не законны",
    "незаконны",
    "следовател",
    "перевод обратно",
    "спор по перевод",
    "его кинул",
    "начали люди писать",
    "я вернул деньги",
    "без добровольного согласия",
    "подал заяв",
    "была проверка",
    "его ввели в заблуждение",
    // '',
    // '',
    // '',
    // '',
    // '',
    // '',
    // '',
    // '',
    // '',
    // '',
  ];

  const STRONG_KEYWOARDS = [
    "гряз",
    "процессинг",
    "наркотрафик",
    "161",
    "115",
    "фз",
    "мвд",
    "полиц",
    "заявлени",
  ];
  let sellFound = false;
  let buyFound = false;
  const sellPatterns = [
    /[\s,.:;"']\s*к[ао]л\s*[л]*[-]*\s*центр/g,
    /(?<!на\s)(?:за)?бло[кч].*(?:карт[ыау]|сч[её]т|банк)/g,
    /(?<!в\s)(?:карт[ыау]|сч[её]т|банк).*бло[кч](?:ировка)?/g,
    /[,";\s:.!?]мент[ы]?[.:,\s"!?;]?/g,
    /(?:е[её]|их|его)\sобманул/g,
    /[,";\s:.!?]суд[^я][ы]?[.:,\s"!?;]?/g,
    /(?:потерпевш[иае][ийяе]|пострадавш[ауией][еуйяаю]?[г]?[о]?)/g,
    /(?:карт[ыау]|сч[её]т|банк).*отлетел[иа]/g,
    /отлетел[иа].*(?:карт[ыау]|сч[её]т|банк)/g,
    /закон[\s,.;:!?]/g,
    /(?<!отрицательный\s|оставленный\s|негативный\s|плохой\s)отзыв[\s,.;:!?]/g,
    /(?<!просьб[ыу]\s)вернуть/g,
    /(?<!моей\s)ошибк/g,
    /начинают\sзвонит/g,
    /(?<!посодействовал\s)возврат/g,
  ];
  const buyPatterns = [
    /\D24\D/g,
    /монет/g,
    /(?<!(?:продаж[иа]|отпустил[аи]?)\s)(?:usdt|ю[сз]дт)/gi,
    /отпустил/g,
    /т+1/g,
    /видео/g,
    /выписк/g,
    /продав[ец]?[ацо]?[м]?/g,
    /вернет/g,
    /до перевода/g,
    /арбитраж/g,
    /возвращать ничего не будет/g,
    /ап{1,3}ел{1,3}яц[ие][иаяюе]/g,
    /таймер/g,
    /запис[ьа][т]?[ь]?\sэкран[а]?/g,
    /реквизиты\sдал/g,
    /активы/g,
    /скрин/g,
    /разбить|разделить/g,
    /диспут/g,
    //g,
    //g,
  ];
  for (const pattern of sellPatterns) {
    if (pattern.test(remark)) {
      sellFound = true;
      if (debug) console.log(pattern);
      break;
    }
  }
  for (const pattern of buyPatterns) {
    if (pattern.test(remark)) {
      buyFound = true;
      if (debug) console.log(pattern);

      break;
    }
  }

  const trueShit = STRONG_KEYWOARDS.some((phrase) => remark.includes(phrase));
  const foundDanger = KEYWORDS_TO_HIGHLIGHT.some((phrase) =>
    remark.includes(phrase)
  );
  const debugDanger = KEYWORDS_TO_HIGHLIGHT.find((phrase) =>
    remark.includes(phrase)
  );

  if (trueShit) return true;
  if (foundDanger && debug) console.log(debugDanger);
  return (foundDanger || sellFound) && !buyFound;
}
export function analyzeReview(reviewText: string | null | undefined): ReviewAnalysis {
  if (!reviewText) return { shouldHide: false, shouldHighlight: false };

  let shouldHide = false;

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

  const shouldHighlight = shouldHighlight1(reviewText, false)
  if(shouldHighlight)shouldHide = false

  return { shouldHide, shouldHighlight };
}
