import { findBuyCard } from "../../features/buy/automation/cardFinder";
import type { Ad, ApiResult, GenericApiResponse } from "../types/ads";


const BANK_NAMES = [
   "Тинькофф",
   "Сбербанк",
   "Альфа-Банк",
   "ВТБ",
   "Газпромбанк",
   "Райффайзенбанк",
   "Росбанк",
   "МКБ",
   "Совкомбанк",
   "Яндекс",
   "Почта Банк",
   "Ак Барс",
   "УралСиб",
   "Русский Стандарт",
   "Промсвязьбанк",
   "ОТП Банк",
   "Россельхозбанк",
   "Озон",
] as const;

type BankName = (typeof BANK_NAMES)[number];

// 2. Делаем структуру readonly для оптимизации компилятором
type BankVariants = Readonly<Record<BankName, ReadonlyArray<string | RegExp>>>;

const bankVariants: BankVariants = {
   Тинькофф: [/[tт]ин[ь]?к/, /[тt]\-*_*[.]*\s*_*б[аa]нк/, "t-bank"],
   Сбербанк: [/[сc]б[еe][рp]/, "sber"],
   "Альфа-Банк": ["альф", "alfa"],
   ВТБ: ["втб"],
   Газпромбанк: ["газпром"],
   Райффайзенбанк: ["райф"],
   Росбанк: ["росбанк"],
   МКБ: ["мкб", /московский\s*-*[.]*\s*кредитный/],
   Совкомбанк: ["совком"],
   Яндекс: ["яндекс"],
   "Почта Банк": [/почта\s*-*[.]*\s*банк/],
   "Ак Барс": [/ак\s*-*[.]*\s*барс/],
   УралСиб: [/урал\s*-*[.]*\s*сиб/],
   "Русский Стандарт": [/русский\s*-*[.]*\s*стандарт?/],
   Промсвязьбанк: [/пром\s*-*[.]*\s*связ/, "псб"],
   "ОТП Банк": [/(?:^|[\s.,;:-])отп(?:[\s.,;:-]|$)/],
   Россельхозбанк: ["россельхоз", "рсхб"],
   Озон: ["озон", "ozon"],
};

// 3. Компилируем паттерны один раз при инициализации
// Превращаем строки в RegExp с флагом 'i', чтобы не делать toLowerCase()
const COMPILED_BANKS: ReadonlyArray<{ name: BankName; matcher: RegExp }> =
   Object.entries(bankVariants).map(([name, variants]) => {
      const pattern = variants
         .map((v) =>
            typeof v === "string"
               ? v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
               : v.source
         )
         .join("|");
      return {
         name: name as BankName,
         matcher: new RegExp(pattern, "i"),
      };
   });

/**
 * Оптимизированный поиск
 * Исключает аллокацию lowerText и Set внутри цикла
 */
function findAllMentionedBanks(text: string): BankName[] {
   const result: BankName[] = [];

   // Обычный for быстрее, чем forEach/map для горячих путей
   for (let i = 0; i < COMPILED_BANKS.length; i++) {
      const { name, matcher } = COMPILED_BANKS[i];
      if (matcher.test(text)) {
         result.push(name);
      }
   }

   return result;
}

function replaceEmojiWithDots(text: string): string {
   // Константа для минимального расстояния
   const SEPARATOR_DISTANCE = 20;

   // Регулярное выражение для поиска эмодзи (включая составные эмодзи с модификаторами)
   const emojiRegex =
      /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u{FE0F}|\u{200D}[\p{Emoji_Presentation}\p{Emoji}]|[\u{1F3FB}-\u{1F3FF}])*/gu;

   // 1. Предварительная замена для цифр (проблема, которую мы решали ранее)
   // Мы предполагаем, что замена 2️⃣, 3️⃣, 4️⃣, 5️⃣ на 1️⃣ должна выполниться ПЕРЕД анализом.
   let result = text.replace(/[\u0032-\u0035]\ufe0f\u20e3/g, "1️⃣");

   // 2. Находим все эмодзи и их позиции в УЖЕ измененной строке
   const matches = [];
   let match;
   // Сбрасываем lastIndex перед использованием exec в цикле!
   emojiRegex.lastIndex = 0;
   while ((match = emojiRegex.exec(result)) !== null) {
      matches.push({
         emoji: match[0],
         index: match.index,
         length: match[0].length,
         // Дополнительно: флаг, чтобы не менять эмодзи, которые уже были помечены как разделители
         isSeparator: false,
      });
   }
   //console.log(matches); // Вывод, который вы предоставили, находится здесь

   // 3. Анализ: помечаем эмодзи, которые являются "разделителями"
   for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];

      // Ищем следующее совпадение ТОГО ЖЕ САМОГО эмодзи
      let nextMatchIndex = -1;
      for (let j = i + 1; j < matches.length; j++) {
         if (matches[j].emoji === currentMatch.emoji) {
            nextMatchIndex = matches[j].index;
            break;
         }
      }

      // Если следующее такое же эмодзи найдено, проверяем расстояние
      if (nextMatchIndex !== -1) {
         const distance =
            nextMatchIndex - (currentMatch.index + currentMatch.length);
         // Если расстояние больше 20, это эмодзи - разделитель
         if (distance > SEPARATOR_DISTANCE) {
            currentMatch.isSeparator = true;
         }
      } else {
         // Если это последнее эмодзи данного типа в тексте, оно также может быть разделителем,
         // если его нужно удалить по логике, но в данном случае мы ищем *расстояние между*.
         // Оставим его как не-разделитель по умолчанию.
      }
   }

   // 4. Замена: строим новую строку
   let newResult = "";
   let lastIndex = 0; // Индекс, до которого мы скопировали из 'result'

   for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];

      // 1. Добавляем часть строки ОТ предыдущей позиции ДО текущего эмодзи
      // Это текстовое содержимое между двумя эмодзи или от начала строки до первого эмодзи.
      newResult += result.substring(lastIndex, currentMatch.index);

      if (currentMatch.isSeparator) {
         // 2. Если это разделитель, добавляем точку '.'
         newResult += ".";
      } else {
         // 3. Если это не разделитель, добавляем хуй
         newResult += currentMatch.emoji;
      }

      // Обновляем lastIndex: теперь мы скопировали до конца текущего эмодзи
      lastIndex = currentMatch.index + currentMatch.length;
   }

   // 4. Добавляем оставшуюся часть строки после последнего эмодзи
   newResult += result.substring(lastIndex);
   //console.log(newResult);
   // Возвращаем новую строку
   return newResult;
}

function cleanText(text: string): string {
   // Regex для всех эмодзи и символов вариации
   const emojiRegex =
      /[\u{1F000}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}\u{200D}\u{20E3}]+/gu;

   // Заменяем специальные символы на точки для унификации
   let result = text.replace(/[\[\]{}()!.🏻]/g, ".").replace(/друг/gi, ".друг.");

   // --- 🆕 Новая логика: Обработка повторяющихся эмодзи с расстоянием > 20 символов ---
   result = replaceEmojiWithDots(result);
   // --- 🆕 Конец новой логики ---
   result = result.replace(/[13]\s*лицо/gi, "");
   // --- 🌟 Обработка эмодзи с учетом контекста ---
   result = result.replace(emojiRegex, (match, offset, string) => {
      // 1. Правило: Если эмодзи граничит с запятой (Эмодзи, или ,Эмодзи) -> Удаляем эмодзи
      const charImmediatelyBefore = string[offset - 1];
      const charImmediatelyAfter = string[offset + match.length];

      if (charImmediatelyBefore === "," || charImmediatelyAfter === ",") {
         return ""; // Удаляем эмодзи
      }

      // 2. Правило: [Заглавная Буква] [Пробел] [Эмодзи] [Пробел] [Заглавная Буква] -> Удаляем эмодзи
      const charBeforeSpaceIndex = offset - 2;
      const charAfterSpaceIndex = offset + match.length + 1;

      const isCharBeforeSpaceCapital =
         charBeforeSpaceIndex >= 0 &&
         string[offset - 1] === " " &&
         /[A-ZА-ЯЁ]/.test(string[charBeforeSpaceIndex]);

      const isCharAfterSpaceCapital =
         charAfterSpaceIndex < string.length &&
         string[offset + match.length] === " " &&
         /[A-ZА-ЯЁ]/.test(string[charAfterSpaceIndex]);

      if (isCharBeforeSpaceCapital && isCharAfterSpaceCapital) {
         return ""; // Удаляем эмодзи
      }

      // 3. Логика определения конца предложения (Оригинальная логика)
      let beforeIndex = offset - 1;
      while (beforeIndex >= 0 && /\s/.test(string[beforeIndex])) {
         beforeIndex--;
      }
      const charBefore = beforeIndex >= 0 ? string[beforeIndex] : "";

      let afterIndex = offset + match.length;
      while (afterIndex < string.length && /\s/.test(string[afterIndex])) {
         afterIndex++;
      }
      const charAfter = afterIndex < string.length ? string[afterIndex] : "";

      if (
         charAfter &&
         /[A-ZА-ЯЁ]/.test(charAfter) &&
         charBefore &&
         !/[.!?,;:]/.test(charBefore)
      ) {
         return ".";
      }

      return "";
   });
   // --- 🌟 Конец обработки эмодзи ---

   // --- 🆕 ИСПРАВЛЕНА ЛОГИКА: Обработка нумерованных списков (1. asd 2. asd -> asd, asd) ---
   result = result.replace(/(\d+)\.\s*/g, (offset, fullString) => {
      // Проверяем, является ли это первым элементом списка (в начале строки)
      const precedingText = fullString.substring(0, offset);

      if (precedingText.trim().length === 0) {
         // Это первый элемент (1. ) -> просто удаляем (заменяем на пробел для очистки)
         return " ";
      } else {
         // Это последующий элемент (2. , 3. ) -> заменяем на " "
         return " ";
      }
   });
   // --------------------------------------------------------------------------

   // Убираем множественные пробелы
   result = result.replace(/\s+/g, " ");

   // Убираем пробелы перед знаками препинания
   result = result.replace(/\s+([.,!?;:])/g, "$1");

   // Убираем пробелы внутри скобок
   result = result.replace(/\(\s+/g, "(");
   result = result.replace(/\s+\)/g, ")");

   // Убираем пробелы внутри квадратных скобок
   result = result.replace(/\[\s+/g, "[");
   result = result.replace(/\s+\]/g, "]");

   while (result.includes("‼")) result = result.replace("‼", ".");

   // Обрабатываем случаи с точками после пробелов
   result = result
      .trim()
      .toLowerCase()
      .replace(/\.{2,}/g, ".")
      .replace(". .", ". ");

   // Добавляем точку в конце, если нет знака препинания
   if (result.length > 0 && !/[.!?]$/.test(result)) {
      result += ".";
   }

   result = result.replace(
      /(?<!не\s)принимаю.*(,)/g,
      (m) => m.slice(0, -1) + "."
   );

   // 4. Финальная подчистка двойных пробелов и точек
   result = result.replace(/\s+/g, " ").trim();

   return result;
}
// Удаляет из текста фрагменты, где банки упоминаются как получатели
function removeRecipientBanks(text: string): string {
   let result = text;

   const recipientPatterns = [
      // "на/в" с возможными повторами (но не перед номером телефона/скобкой)

      /[.,;\s]на\s+[а-я]+/g,

      /(?:\s+|^)(?:на|в)\s+(?:карту\s+)?(?:(?!руках)[а-я\s]){2,30}/gi,

      /(?:карт[ыае]|счет|номер)[.,]+[а-я]+/g,

      /карт[аые]\s*[а-я]+/g,
   ];

   recipientPatterns.forEach((pattern) => {
      result = result.replace(pattern, (match) => {
         // Проверяем, упомянут ли какой-то банк в найденном фрагменте
         const mentionedBanks = findAllMentionedBanks(match);
         if (mentionedBanks.length > 0) {
            // Только если найден хотя бы один банк — заменяем
            return " ";
         }
         // Иначе оставляем как есть
         return match;
      });
   });

   return result.replace(/\s+/g, " ").trim();
}
interface CleanedData {
   text: string;
   excluded: BankName[];
}
function removeExcludedBanks(input: string): CleanedData {
   let result = input;
   const excludedSet = new Set<BankName>();

   const excludePatterns = [
      // 1. "не принимаю с [банк]"
      /не\s+(?:(?:принима[юе][тм]?[ся]?|прим[уе][м]?|работа[юе]м?)\s)?(?:платеж[и]?|перевод[ы]?|оплат[аыу]?)?\s?(?:с|со|от|из)\s?[^.;\n]+/g,
      // 2. "кроме [банк/список банков]"
      /кроме\s+[^.,;!?\n]+/g,
      // 3. "[банк] не принимаю"
      /(?:(?!(?:^|\s)(?:принимаю|только|на|перевод|по|карт)(?:\s|$))[а-яa-z\-—\s,])+\s*(?<!верси(?:[июя]|ей)\s)(?:платеж[и]?|перевод[ы]?|оплат[аыу]?)?не\s*(?:принима[юе][тм]?[ся]?|прим[уе][м]?)(?!\sс\s(?:ип|веб|т-бизнеса|ооо))/g,
      // 4. "исключая [банк]"
      /(?:исключа[яю]|за\s+исключением)\s+[а-я]+/g,
      // 5. "не принимаю: [список]"
      /не\s+(?:принима[юе][тм]?[ся]?|прим[уе][м]?)\s*[:;]\s*[^.\n]+/g,
   ];

   excludePatterns.forEach((pattern) => {
      result = result.replace(pattern, (match) => {
         const mentionedBanks = findAllMentionedBanks(match);

         if (mentionedBanks.length > 0) {
            // Сохраняем найденные банки в Set перед удалением
            mentionedBanks.forEach((bank) => excludedSet.add(bank));
            return " ";
         }
         return match;
      });
   });

   result = result.replace(/\s+/g, " ").trim();

   return {
      text: result,
      excluded: Array.from(excludedSet),
   };
}
function removeExcludedSellBanks(input: string): string {
   let result = input;

   // Паттерны для запретов
   const excludePatterns = [
      // 1. "не отправляю на [банк]", "не скидываю на [банк]", "не перевожу на [банк]"
      // Примеры: "не отправляю на сбер", "не скидываю на тинькофф", "не перевожу на альфу"
      /не\s+(?:отправля[юе][тм]?[ся]?|скидыва[юе][тм]?[ся]?|перево[жд][ую][тм]?[ся]?|переведу|скину|отправлю)\s+(?:платеж[и]?|перевод[ы]?)?\s?(?:на|в)\s?[^.;\n]+/gi,

      // 2. "кроме [банк/список банков]" (остаётся без изменений, работает в обе стороны)
      // Примеры: "кроме сбербанка", "кроме тинькофф и альфы"
      /кроме\s+[^.,;!?\n]+/gi,

      // 3. "на [банк] не отправляю/не перевожу/не скидываю"
      // Примеры: "на сбербанк не отправляю", "на тинькофф не перевожу"
      // Работает после начала строки или знака препинания
      /(?:на|в)\s+([а-я\-]+)\s+не\s+(?:отправля[юе][тм]?[ся]?|скидыва[юе][тм]?[ся]?|перево[жд][ую][тм]?[ся]?|переведу|скину|отправлю)/gi,

      // 4. "исключая [банк]" или "за исключением [банк]" (остаётся без изменений)
      // Примеры: "исключаю сбер", "за исключением тинькофф"
      /(?:исключа[яю]|за\s+исключением)\s+[а-я]+/gi,

      // 5. "не отправляю/не перевожу/не скидываю: [список банков через запятую]"
      // Примеры: "не отправляю: озон, сбер, альфа", "не перевожу; тинькофф, райф"
      // Захватывает всё до точки или конца строки
      /не\s+(?:отправля[юе][тм]?[ся]?|скидыва[юе][тм]?[ся]?|перево[жд][ую][тм]?[ся]?|переведу|скину|отправлю)\s*[:;]\s*[^.\n]+/gi,
   ];

   excludePatterns.forEach((pattern) => {
      result = result.replace(pattern, (match) => {
         // Проверяем, упомянут ли какой-то банк в найденном фрагменте
         const mentionedBanks = findAllMentionedBanks(match);
         if (mentionedBanks.length > 0) {
            // Только если найден хотя бы один банк — заменяем
            return " ";
         }
         // Иначе оставляем как есть
         return match;
      });
   });

   // Нормализуем пробелы
   result = result.replace(/\s+/g, " ").trim();

   return result;
}
// Находит все упомянутые банки в очищенном тексте


// function isFromAnyBank(text: string): boolean {
//    if (!text) return false;

//    const pattern=/(?:со?|из)\s+(?:люб[оы](?:го|х)|всех)\s+банк(?:а|ов)/
   
//    return pattern.test(text);

// }
// Главная функция с новым подходом
export function availableBanks(description: string): string[] {
   let remark = cleanText(description);

   // Шаг 1: Извлекаем исключенные банки и чистим текст
   const { text: textWithoutExclusion, excluded } = removeExcludedBanks(remark);
   remark = textWithoutExclusion;

   // Шаг 2: Удаляем банки-получатели (ваша существующая логика)
   remark = removeRecipientBanks(remark);

   // Шаг 3: Ищем явно разрешенные банки
   const explicitBanks = findAllMentionedBanks(remark);


   // Логика выбора результата:

   // 1. Если указаны конкретные банки для перевода (напр. "на сбер и тиньк")
   if (explicitBanks.length > 0) {
      return explicitBanks;
   }

   // 2. Если явных нет, но есть список "кроме" (напр. "кроме озона")
   if (excluded.length > 0) {
      // Возвращаем все банки из справочника, которых нет в excluded
      return BANK_NAMES.filter((name) => !excluded.includes(name));
   }

   // 3. Если ничего не найдено
   return ["*"];
}

export function availableBanksSell(description: string): string[] {
   // Очищаем текст с помощью твоей функции
   const text = cleanText(description);

   let remark = removeExcludedSellBanks(text);

   let foundBanks: string[] = findAllMentionedBanks(remark);

   return foundBanks.length > 0 ? foundBanks : ["*"];
}


type AdOrApi = Ad | (ApiResult & GenericApiResponse);

export function updateMaxAmount<T extends AdOrApi>(item: T): T {
   const remarkRaw = (item as any).remark;
   if (!remarkRaw) return item;

   const remark = remarkRaw.toLowerCase();
   const currentPrice = parseFloat(item.price);
   const currentMaxAmount = parseFloat(item.maxAmount);

   if (isNaN(currentPrice) || isNaN(currentMaxAmount)) return item;

   // --- 1. Кратные (Приоритетная жесткая логика) ---
   // Если указана кратность, мы обязаны ей следовать, вариативности тут обычно нет.
   const kratnyeMatch = remark.match(/кратн(?:ые|ых|ая)\s*[\d.,]*/g);
   if (kratnyeMatch) {
      const part = kratnyeMatch[0] || "";
      const match = part.match(/\d+(?:[.,\s]\d+)?/);
      const num = match ? parseFloat(match[0].replace(",", ".")) : null;

      if (num && num !== 0) {
         const result = currentMaxAmount - (currentMaxAmount % num);
         // Здесь мы не проверяем карту, так как кратность — это условие математическое, а не "выбор из списка"
         // Но при желании можно добавить проверку и сюда.
         applyChanges(item, result, currentPrice);
         return item;
      }
   }

   // --- 2. Поиск чисел (Логика подбора) ---
   const allNumbers = remark.match(/\d+[.,\s]?\d*/g);
   let candidates: number[] = [];

   if (allNumbers && allNumbers.length > 0) {
      candidates = allNumbers
         .map((s: string) => {
            const floatGuess = parseFloat(s.replace(",", "."));
            // Эвристика: если число < 10000, возможно это часть номера карты или мусор,
            // пробуем убрать разделители.
            if (floatGuess < 10000) {
               const withoutSep = s.replace(/[.\s]/g, "");
               return parseFloat(withoutSep);
            }
            return floatGuess;
         })
         .filter((n: number) => Number.isFinite(n) && n <= currentMaxAmount); // Фильтруем сразу превышающие текущий лимит
   }

   if (candidates.length === 0) return item;

   // Сортируем по убыванию, чтобы найти максимально возможный объем
   const uniqueCandidates = [...new Set(candidates)].sort((a, b) => b - a);



   const minPrice = parseFloat(localStorage.getItem("minPrice") || "77");
   if(uniqueCandidates.length>1) {
      // --- 3. Перебор кандидатов ---
      for (const amount of uniqueCandidates) {
         // Применяем изменения
         applyChanges(item, amount, currentPrice);

         // Проверяем наличие карты под этот объем
         // (item as Ad) - потенциально опасное приведение, см. "Допущения" п.3
         const cardFound = findBuyCard(item as Ad, minPrice);

         if (cardFound) {
            // Карта есть, объем подходит. Возвращаем измененный item.
            return item;
         }
      }
   }

   return item;
}


export function addPaymentsToAds(ads: Ad[]): Ad[] {
   ads.forEach((ad) => {
      ad.payments = availableBanks(ad.remark);
   })
   return ads
}
/**
 * Вспомогательная функция для мутации объекта.
 */
function applyChanges(item: AdOrApi, newMaxAmount: number, price: number) {
   item.maxAmount = newMaxAmount.toFixed(2);
   const newQuantity = (newMaxAmount / price).toFixed(4);

   if ('quantity' in item) {
      (item as Ad).quantity = newQuantity;
   } else {
      (item as any).lastQuantity = newQuantity;
   }
}

export function bankLatinToCyrillic(name: string): string {
   const map: Record<string, string> = {
      // 🇷🇺 Крупные банки
      sber: "Сбер",
      tbank: "Т-Банк",
      alfa: "Альфа-Банк",
      vtb: "ВТБ",
      raif: "Райффайзен",
      gazprom: "Газпромбанк",
      psb: "ПСБ",
      rshb: "Россельхозбанк",
      mts: "МТС Банк",
      sovcom: "Совкомбанк",
      uralsib: "Уралсиб",
      rnkb: "РНКБ"
   };

   const key = name.toLowerCase();
   return map[key] || name;
}
