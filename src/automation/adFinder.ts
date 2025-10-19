import type { OrderPayload } from "../components/buyModal";
import { adShouldBeFiltered } from "../logic/adFilter";
import type { Ad } from "../types/ads";

export interface Card {
   id: string;
   bank: "tbank" | "sber";
   balance: number; // остаток
   turnover: number; // оборот за сегодня
   date: Date; // дата последнего обновления оборота
}

interface CardUsageMap {
   [cardId: string]: number; // timestamp последнего использования
}

const STORAGE_KEY = '!cards_last_used';
const COOLDOWN_TIME = 1_200_000; // 20 минут в миллисекундах


// ==== Helpers для localStorage ====

function isSameDay(date1: Date | string | number, date2: Date | string | number): boolean {
   const d1 = date1 instanceof Date ? date1 : new Date(date1);
   const d2 = date2 instanceof Date ? date2 : new Date(date2);

   return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
   );
}


export function loadCards(): Card[] {
   const raw = localStorage.getItem("!cards");
   if (!raw) return [];

   try {
      const today = new Date();
      // JSON.parse преобразует дату в строку, поэтому нам нужно обработать это
      const cardsFromStorage: any[] = JSON.parse(raw);

      return cardsFromStorage.map((card) => {
         const cardDate = new Date(card.date);

         // Если сохраненная дата не совпадает с сегодняшним днем
         if (!isSameDay(cardDate, today)) {
            // Сбрасываем оборот и обновляем дату на текущую
            return {
               ...card,
               turnover: 0,
               date: today,
            };
         }

         // Если день тот же, просто преобразуем строку в объект Date
         return {
            ...card,
            date: cardDate,
         };
      });
   } catch (e) {
      console.error("Error loading or processing cards:", e);
      return [];
   }
}


// ==== Весовые функции ====
function priceWeight(price: number, minPrice: number): number {
   if (price <= minPrice) {
      return 1.0;
   } else if (price <= minPrice * 1.005) {
      // линейная интерполяция от 1 до 0.5
      return 0.5 + ((1.0 - 0.5) * (1.005 - price / minPrice)) / 0.005;
   } else if (price <= minPrice * 1.01) {
      // линейная интерполяция от 0.5 до 0.3
      return 0.3 + ((0.5 - 0.3) * (1.01 - price / minPrice)) / 0.005;
   } else {
      return 0.3;
   }
}

function amountWeight(amount: number): number {
   if (amount <= 10000) return 1.0;
   if (amount <= 20000) return 1.0 + ((1.4 - 1.0) * (amount - 10000)) / 10000;
   if (amount <= 30000) return 1.4 + ((1.7 - 1.4) * (amount - 20000)) / 10000;
   if (amount <= 40000) return 1.7 + ((2.0 - 1.7) * (amount - 30000)) / 10000;
   return 2.0;
}
export function availableBanks(description: string): string[] {
   const lowerDesc = description.toLowerCase();
   type BankVariants = {
      [key: string]: string[];
   };
   const bankVariants: BankVariants = {
      'Тинькофф': ['тинькофф', 'тинькоф', 'тиньков', 'тинькова', 'тинка', 'тинькоффа', 'т-банк', 'тиньки', 'тинька', 'т банк', 'тбанк', 'т банка', 'тбанка', 'т-банка', '🟡т-банк🟡'],
      'Сбербанк': ['сбер', 'сбербанк', 'сбера', 'сбербанка', 'сбербанке', 'сберу', '🟢сбер🟢'],
      'Альфа-Банк': ['альфа', 'альфабанк', 'альфа-банк', 'альфа банку', 'альфы', 'альфе', 'альфа-банка'],
      'ВТБ': ['втб', 'втб24', 'втб банка', 'втбшки'],
      'Газпромбанк': ['газпром', 'газпромбанк', 'газпромбанка', 'газпрома'],
      'Райффайзенбанк': ['райффайзен', 'райф', 'райфа', 'райффайзенбанк', 'райффайзенбанка'],
      'Росбанк': ['росбанк', 'росбанка'],
      'Открытие': ['открытие', 'открытия', 'открытием', 'банк открытие'],
      'МКБ': ['мкб', 'московский кредитный', 'московский кредитный банк', 'мкбшки'],
      'Совкомбанк': ['совком', 'совкомбанк', 'совкомбанка'],
      'Почта Банк': ['почта банк', 'почта банка'],
      'Ак Барс': ['ак барс', 'акбарс', 'ак барса', 'акбарса', 'ак барсе'],
      'УралСиб': ['уралсиб', 'урал сиб', 'уралсиба'],
      'Промсвязьбанк': ['промсвязь', 'промсвязьбанк', 'псб', 'промсвязьбанка'],
      'Россельхозбанк': ['россельхоз', 'рсхб', 'россельхозбанк', 'россельхозбанка'],
      'Озон': ['озон', 'озона', 'озоне', 'озоном', 'озон банк'],
   };

   const allBanks = Object.keys(bankVariants);

   // Вспомогательная функция для поиска банков в тексте
   const findBanksInText = (text: string): Set<string> => {
      const found = new Set<string>();
      allBanks.forEach(bank => {
         const variants = bankVariants[bank] || [];
         if (variants.some((variant: string) => text.includes(variant))) {
            found.add(bank);
         }
      });
      return found;
   };

   // Фильтр для игнорирования нерелевантного контекста
   const isIrrelevantContext = (text: string): boolean => {
      return /браузер|веб|верси|мобильн|приложен|ios|android|\d+%|процент|лиц|физлиц|ип/i.test(text);
   };

   // --- Шаг 1: Находим исключения ---
   const excludedBanks = new Set<string>();

   const exclusionPatterns = [
      // "не принимаю/принимаем/принимают с/со/от/из X"
      /не\s+принима(ю|ем|ет|ют)\s+(?:платеж|платёж|перевод|оплату)?\s*(?:со?|с|от|из)\s+([^.,!?]+)/gi,
      /не\s+приму\s+(?:платеж|платёж|перевод|оплату)?\s*(?:со?|с|от|из)\s+([^.,!?]+)/gi,
      // "не работаю/работаем/работают с/от X"
      /не\s+работа(ю|ем|ет|ют)\s+(?:со?|с|от)\s+([^.,!?]+)/gi,
      // "кроме X"
      /кроме\s+([^.,!?]+)/gi,
      // "исключая/исключаю X"
      /исключ[аяе][юя]\s+([^.,!?]+)/gi,
      // "с/от X не принимаю/приму"
      /(?:со?|с|от|из)\s+([^.,!?]+?)\s+не\s+(?:принима(ю|ем|ет|ют)|приму|работа(ю|ем|ет|ют))/gi,
   ];

   exclusionPatterns.forEach(pattern => {
      const matches = [...lowerDesc.matchAll(pattern)];
      matches.forEach(match => {
         const exclusionText = match[1].trim();
         if (isIrrelevantContext(exclusionText)) return;

         // Разбиваем по "и", ",", точкам с номерами
         const parts = exclusionText.split(/\s+и\s+|,\s*|\d+\.\s*/);
         parts.forEach(part => {
            const cleanPart = part.trim();
            if (cleanPart.length > 1) {
               const banksInPart = findBanksInText(cleanPart);
               banksInPart.forEach(bank => excludedBanks.add(bank));
            }
         });
      });
   });
   
   // --- Шаг 2: Обрабатываем парные конструкции "с X на Y" ---
   let normalized = lowerDesc.replace(/\s+/g, ' ').trim();

   // Убираем шумовые фразы
   const fillers = /\b(по\s+номеру\s+карты|по\s+карте|по\s+номер[ау]?|через|по\s+реквизитам|с\s+карты\s+через|строго|только)\b/gi;
   normalized = normalized.replace(fillers, ' ').replace(/\s+/g, ' ');

   const pairPattern = /(?:\bс\b|\bсо\b|\bот\b|\bиз\b)\s+([а-яё0-9\-\s]+?)\s+(?:на|в)\s+[а-яё0-9\-\s]+?(?=[.,!?]|$)/gi;
   const pairMatches = [...normalized.matchAll(pairPattern)];

   const pairSenders = new Set<string>();
   if (pairMatches.length > 0) {
      for (const match of pairMatches) {
         const senderText = (match[1] || '').trim();
         if (isIrrelevantContext(senderText)) continue;

         const banksInSender = findBanksInText(senderText);
         banksInSender.forEach(bank => pairSenders.add(bank));
      }
   }

   // --- Шаг 3: Ищем явные разрешения ("приму с", "принимаю с") ---
   const allowedBanks = new Set<string>();
   const allowPatterns = [
      /(?:приму|принима(ю|ем|ет|ют)|работа(ю|ем|ет|ют))\s+(?:только\s+)?(?:со?|с|от)\s+([^.,!?]+)/gi,
      /(?:также|ещё|еще)\s+(?:приму|принима(ю|ем|ет|ют))\s+(?:со?|с|от)\s+([^.,!?]+)/gi,
   ];

   allowPatterns.forEach(pattern => {
      const matches = [...lowerDesc.matchAll(pattern)];
      matches.forEach(match => {
         const allowText = match[1].trim();
         if (isIrrelevantContext(allowText)) return;

         // Разбиваем по разделителям
         const parts = allowText.split(/\s+и\s+|,\s*|\d+\.\s*/);
         parts.forEach(part => {
            const cleanPart = part.trim();
            if (cleanPart.length > 1) {
               const banksInPart = findBanksInText(cleanPart);
               banksInPart.forEach(bank => allowedBanks.add(bank));
            }
         });
      });
   });

   // --- Шаг 4: Определяем итоговый результат ---
   let result = new Set<string>();

   // Приоритет 1: Если есть парные конструкции "с X на Y", используем только отправителей
   if (pairSenders.size > 0) {
      pairSenders.forEach(bank => result.add(bank));
   }

   // Приоритет 2: Добавляем явно разрешенные банки
   if (allowedBanks.size > 0) {
      allowedBanks.forEach(bank => result.add(bank));
   }

   // Приоритет 3: Если результат пустой, ищем все упомянутые банки (fallback)
   if (result.size === 0) {
      const mentioned = findBanksInText(lowerDesc);
      mentioned.forEach(bank => result.add(bank));
   }

   // Применяем исключения
   excludedBanks.forEach(bank => result.delete(bank));

   // Возвращаем результат
   const finalResult = Array.from(result);
   return finalResult.length > 0 ? finalResult : ['*'];
}



function paymentWeight(ad: Ad, card: Card): number {
   const banks = availableBanks(ad.remark)
   const isSberAd = (banks.includes("Сбербанк") || banks.includes("*"));
   const cardsTbankBalances = loadCards().filter((c) => c.bank === "tbank").map((c) => c.balance);
   const cardsSberBalances = loadCards()
      .filter((c) => c.bank === "sber")
      .map((c) => c.balance);
   //если баланс тбанков опустошен, а сберов - нет
   if (
      cardsTbankBalances.every((balance) => balance <= 20000) &&
      cardsSberBalances.some((balance) => balance >= 20000) &&
      card.bank === "sber" &&
      isSberAd
   ) {
      return 12.0;
   }

   if (card.bank === "sber" && isSberAd) return 1.0;
   if (card.bank === "tbank" && !isSberAd) return 0.8;

   return 0; // карта не подходит под способы оплаты
}

function getCardUsageData(): CardUsageMap {
   try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
   } catch (e) {
      console.error('Error reading card usage data:', e);
      return {};
   }
}

function setCardUsageData(data: CardUsageMap): void {
   try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
   } catch (e) {
      console.error('Error saving card usage data:', e);
   }
}

function canUseCard(card: Card, ad: Ad | OrderPayload): boolean {
   let amount: number;

   // Проверка последнего использования
   const usageData = getCardUsageData();
   const lastUsedTime = usageData[card.id];

   if (lastUsedTime) {
      const timeDiff = Date.now() - lastUsedTime;
      if (timeDiff < COOLDOWN_TIME) {
         
         return false;
      }
   }
   if ("maxAmount" in ad) {
      //объявление на покупку

      amount = parseFloat(ad.maxAmount);
      if (isNaN(amount)) return false;

      if (card.balance - amount < 10_000) return false;
      if (card.turnover + amount > 100_000) return false;

      return paymentWeight(ad, card) > 0;
   } else {
      //объявление на продажу

      amount = parseFloat(ad.amount);
      if (isNaN(amount)) return false;

      if (card.turnover + amount > 100_000) return false;
   }

   return true;
}

export function markCardAsUsed(cardId: string): void {
   const usageData = getCardUsageData();
   const now = Date.now();
   localStorage.setItem("tradingModalCooldown", now.toString());// общее кд между ордерами чтобы не перегружаться
   usageData[cardId] = Date.now();
   setCardUsageData(usageData);
}


// ======== Выбор карты для продажи ========

export function findSellCard(ad: OrderPayload): Card | null {
   // Загружаем все карты
   let cards = loadCards();

   // Фильтруем подходящие карты
   const available = cards.filter((c) => canUseCard(c, ad));

   if (!available.length) return null;

   // если есть рабочие тиньки, то они в приоритете
   available.sort((a, b) => {
      const priority = (bank: string) =>
         bank.toLowerCase().includes("tbank")
            ? 1
            : bank.toLowerCase().includes("sber")
               ? 2
               : 3;
      return priority(a.bank) - priority(b.bank);
   });

   let bestCard = available[0];

   markCardAsUsed(bestCard.id);

   // Обновляем cards_v1 (сброс turnover при новом дне)
   localStorage.setItem("!cards", JSON.stringify(cards));

   return bestCard;
}

// ==== Основная функция ====
function calculateValue(ad: Ad, card: Card, minPrice: number): number {
   const price = parseFloat(ad.price);
   const amount = parseFloat(ad.maxAmount);

   const wPrice = priceWeight(price, minPrice);
   const wAmount = amountWeight(amount);
   const wPayment = paymentWeight(ad, card);


   // веса факторов
   const priceCoef = 0.6;
   const paymentCoef = 0.25;
   const amountCoef = 0.15;
   // console.log(
   //    wPrice * priceCoef + wPayment * paymentCoef + wAmount * amountCoef
   // );

   return wPrice * priceCoef + wPayment * paymentCoef + wAmount * amountCoef;
}

// ======== Выбор карты для покупки ========
export function findBuyCard(ad: Ad, minPrice: number): Card | null {
   const cards = loadCards();
   if (!cards.length) return null;

   let best: { card: Card; value: number } | null = null;

   for (const card of cards) {
      if (!canUseCard(card, ad)) continue;

      const value = calculateValue(ad, card, minPrice);
      if (value <= 0) continue;

      if (!best || value > best.value) {
         best = { card, value };
      }
   }
   return best ? best.card : null;
}

// ==== Основная функция ====
export function findBestBuyAd(ads: Ad[]): { ad: Ad; card: Card } | null {
   ads = ads.filter((a) => !adShouldBeFiltered(a));
   if (!ads.length) return null;

   const minPrice = Math.min(...ads.map((a) => parseFloat(a.price)));
   let best: { ad: Ad; card: Card; value: number } | null = null;

   for (const ad of ads) {
      const card = findBuyCard(ad, minPrice);
      if (!card) continue;

      const value = calculateValue(ad, card, minPrice);

      if (!best || value > best.value) {
         best = { ad, card, value };
      }
   }
   const COOLDOWN_MS = 5 * 60 * 1000; // 5 минут


   const lastTime = Number(
      localStorage.getItem("tradingModalCooldown") || "0"
   );
   const now = Date.now();

   if ((now - lastTime >= COOLDOWN_MS) && best) {

      return { ad: best.ad, card: best.card };

   } else {
      const remainingMs = COOLDOWN_MS - (now - lastTime);
      const minutes = Math.floor(remainingMs / 1000 / 60);
      const seconds = Math.floor((remainingMs / 1000) % 60);

      console.log(
         `КД ещё не прошло (осталось ${minutes} мин ${seconds} сек)`
      );
      return null;
   }
}