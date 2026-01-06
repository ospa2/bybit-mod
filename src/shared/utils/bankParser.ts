import type { Ad, ApiResult, GenericApiResponse } from "../types/ads";

type BankVariants = {
   [key: string]: (string | RegExp)[];
};
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

function removeExcludedBanks(input: string): string {
   let result = input;

   // Паттерны для запретов
   const excludePatterns = [
      // 1. "не принимаю с [банк]"
      // Примеры: "не принимаю с альфы", "не принимаем платеж от сбербанка"
      /не\s+(?:(?:принима[юе][тм]?[ся]?|прим[уе][м]?)\s)?(?:платеж[и]?|перевод[ы]?|оплат[аыу]?)?\s?(?:с|со|от|из)\s?[^.;\n]+/g,

      // 2. "кроме [банк/список банков]"
      // Примеры: "кроме сбербанка", "кроме тинькофф и альфы"
      /кроме\s+[^.,;!?\n]+/g,

      // 3. "[банк] не принимаю"
      /(?:(?!(?:^|\s)(?:принимаю|только|на|перевод)(?:\s|$))[а-яa-z\-—\s,])+\s*(?<!верси(?:[июя]|ей)\s)(?:платеж[и]?|перевод[ы]?|оплат[аыу]?)?не\s*(?:принима[юе][тм]?[ся]?|прим[уе][м]?)(?!\sс\s(?:ип|веб|т-бизнеса|ооо))/g,

      // 4. "исключая [банк]" или "за исключением [банк]"
      // Примеры: "исключаю сбер", "за исключением тинькофф"
      /(?:исключа[яю]|за\s+исключением)\s+[а-я]+/g,

      // 5. "не принимаю: [список банков через запятую]"
      // Примеры: "не принимаю: озон, сбер, альфа", "не приму; тинькофф, райф"
      // Захватывает всё до точки или конца строки
      /не\s+(?:принима[юе][тм]?[ся]?|прим[уе][м]?)\s*[:;]\s*[^.\n]+/g,
   ];

   const anyBankPatterns = [/с\sлюбого\sбанк/];
   let anyBank = false;
   anyBank = anyBankPatterns.some((pattern) => {
      return pattern.test(input);
   });

   excludePatterns.forEach((pattern) => {
      result = result.replace(pattern, (match) => {
         // Проверяем, упомянут ли какой-то банк в найденном фрагменте
         const mentionedBanks = findAllMentionedBanks(match);
         if (mentionedBanks.length > 0 || anyBank) {
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
function findAllMentionedBanks(text: string): string[] {
   function includesBank(text: string, variant: string | RegExp) {
      if (typeof variant === "string") {
         return text.includes(variant);
      } else {
         return variant.test(text);
      }
   }

   const lowerText = text.toLowerCase();
   const found = new Set<string>();

   for (const [bankName, variants] of Object.entries(bankVariants)) {
      for (const variant of variants) {
         if (includesBank(lowerText, variant)) {
            found.add(bankName);
            break;
         }
      }
   }

   return Array.from(found);
}

function isFromAnyBank(text: string): boolean {
   if (!text) return false;

   let remark = cleanText(text);

   const patterns = [
      // с любого банка / с любого российского банка
      /со?\s+любо(го|й)\s+банка/,
      /со?\s+всех\s+банков/,
      /со?\s+любых\s+банков/,

      // из любого банка
      /из\s+любо(го|й)\s+банка/,

   ];
   const noExcludedBanks = removeExcludedBanks(remark).length === remark.length;
   if (noExcludedBanks) {
      return patterns.some((regex) => regex.test(remark));
   } else {
      return false;
   }
}
// Главная функция с новым подходом
export function availableBanks(description: string): string[] {
   // Удаляем эмодзи и лишние пробелы
   let text = cleanText(description);
   // Шаг 1: Удаляем фрагменты с запрещенными банками
   text = removeExcludedBanks(text);
   // Шаг 2: Удаляем фрагменты, где банки упоминаются как получатели
   text = removeRecipientBanks(text);
   // Шаг 3: Ищем все оставшиеся упоминания банков
   const result = findAllMentionedBanks(text);
   // Если ничего не найдено, возвращаем wildcard
   if (isFromAnyBank(description)) return ["*"];

   return result.length > 0 ? result : ["*"];
}

export function availableBanksSell(description: string): string[] {
   // Очищаем текст с помощью твоей функции
   const text = cleanText(description);

   let remark = removeExcludedSellBanks(text);

   let foundBanks: string[] = findAllMentionedBanks(remark);

   return foundBanks.length > 0 ? foundBanks : ["*"];
}


// Определяем объединенный тип для удобства
type AdOrApi = Ad | (ApiResult & GenericApiResponse);

// <T extends AdOrApi> означает: "Я принимаю любой тип T, который похож на Ad или ApiResult"
// (item: T): T означает: "Я верну именно тот тип T, который мне передали"
export function updateMaxAmount<T extends AdOrApi>(item: T): T {
   // 1. Безопасное получение remark
   // (item as any) нужно, так как в ApiResult поля remark формально нет в интерфейсе
   const remarkRaw = (item as any).remark;

   if (!remarkRaw) return item;

   const remark = remarkRaw.toLowerCase();

   // Получаем текущие числовые значения (эти поля price и maxAmount есть в обоих интерфейсах)
   const currentPrice = parseFloat(item.price);
   const currentMaxAmount = parseFloat(item.maxAmount);

   if (isNaN(currentPrice) || isNaN(currentMaxAmount)) return item;

   let maxValue: number | null = null;
   let numbers: number[] = [];

   // --- 1. Кратные ---
   const kratnyeMatch = remark.match(/кратн(?:ые|ых|ая)\s*[\d.,]*/g);
   if (kratnyeMatch) {
      const part = kratnyeMatch[0] || "";
      const match = part.match(/\d+(?:[.,\s]\d+)?/);
      const num = match ? parseFloat(match[0].replace(",", ".")) : null;

      if (num && num !== 0) {
         const result = currentMaxAmount - (currentMaxAmount % num);
         applyChanges(item, result, currentPrice);
         return item;
      }
   }

   // --- 2. Поиск чисел ---
   const allNumbers = remark.match(/\d+[.,\s]?\d*/g);

   if (allNumbers && allNumbers.length > 0) {
      numbers = allNumbers
         .map((s: string) => {
            const floatGuess = parseFloat(s.replace(",", "."));
            if (floatGuess < 10000) {
               const withoutSep = s.replace(/[.\s]/g, "");
               return parseFloat(withoutSep);
            }
            return floatGuess;
         })
         .filter((n: number) => Number.isFinite(n));
   }

   if (numbers.length > 0) {
      maxValue = Math.max(...numbers);
   }

   // --- 3. Применение ---
   if (maxValue !== null && maxValue <= currentMaxAmount) {
      applyChanges(item, maxValue, currentPrice);
   }

   return item;
}

/**
 * Вспомогательная функция для мутации объекта.
 * Определяет, какое поле количества обновлять (quantity или lastQuantity).
 */
function applyChanges(item: AdOrApi, newMaxAmount: number, price: number) {
   // Обновляем сумму (поле maxAmount есть у обоих)
   item.maxAmount = newMaxAmount.toFixed(2);
   const newQuantity = (newMaxAmount / price).toFixed(4);

   // Проверяем наличие свойства quantity, характерного для Ad
   if ('quantity' in item) {
      (item as Ad).quantity = newQuantity;
   } else {
      // Иначе считаем, что это ApiResult, у которого lastQuantity
      // Используем as any, если в типах ApiResult нет lastQuantity явно (но в P2PResult оно есть)
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
