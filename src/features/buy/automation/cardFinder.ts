import { getCardUsageData, setCardUsageData } from "../../../shared/storage/storageHelper";
import type { Ad, OrderPayload } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { availableBanks, availableBanksSell } from "../../../shared/utils/bankParser";

const COOLDOWN_TIME = 1_200_000; // 20 минут

// ==== Весовые функции ====
const STORAGE_KEY = "morningPriceStats";
const CUTOFF_HOUR = 9;
const CUTOFF_MINUTE = 30;

interface MorningStats {
   date: string;       // Дата сбора статистики (YYYY-MM-DD)
   samples: number;    // Количество замеров
   totalSum: number;   // Сумма цен
   avgPrice: number;   // Средняя цена
}

/**
 * Определяет, является ли текущее время "утренним" (до 09:30)
 */
function isMorningPhase(): boolean {
   const now = new Date();
   const hours = now.getHours();
   const minutes = now.getMinutes();
   return hours < CUTOFF_HOUR || (hours === CUTOFF_HOUR && minutes < CUTOFF_MINUTE);
}

/**
 * Возвращает строковое представление текущей даты для сброса статистики
 */
function getTodayString(): string {
   const now = new Date();
   return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/**
 * Управляет логикой "Утренней цены"
 * @param currentMarketPrice Текущая рыночная цена (на основе нормальных объемов)
 * @returns Цена, которую следует использовать как базовую (minPrice)
 */
export function getContextAwareReferencePrice(currentMarketPrice: number): number {
   const today = getTodayString();
   const rawData = localStorage.getItem(STORAGE_KEY);
   let stats: MorningStats = rawData
      ? JSON.parse(rawData)
      : { date: today, samples: 0, totalSum: 0, avgPrice: 0 };

   // Если наступил новый день - сбрасываем статистику
   if (stats.date !== today) {
      console.log("🌅 Новый день: сброс утренней статистики цен.");
      stats = { date: today, samples: 0, totalSum: 0, avgPrice: 0 };
   }

   if (isMorningPhase()) {
      // === ФАЗА СБОРА ДАННЫХ (УТРО) ===

      // Обновляем статистику
      stats.samples++;
      stats.totalSum += currentMarketPrice;
      stats.avgPrice = stats.totalSum / stats.samples;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));

      // Утром работаем по текущей рыночной цене
      return currentMarketPrice;
   } else {
      // === ФАЗА ИСПОЛЬЗОВАНИЯ (ДЕНЬ/ВЕЧЕР) ===

      if (stats.samples > 0) {
         console.log(`📊 Используем утренний контекст: ${stats.avgPrice.toFixed(2)} (Текущая: ${currentMarketPrice})`);

         // ВАЖНО: Если рынок вдруг упал ниже утра (кризис), берем текущую цену, 
         // чтобы не отсечь всё подряд. Но если рынок вырос - держим утреннюю планку.
         return Math.min(stats.avgPrice, currentMarketPrice);
      }

      // Если бот был включен только днем и утренних данных нет - работаем по факту
      console.warn("⚠️ Нет данных об утренних ценах, используем текущую.");
      return currentMarketPrice;
   }
}
function priceWeight(price: number, minPrice: number): number {
   const MAX_PRICE_DIFF = 0.007; // 0.7%

   if (price > minPrice * (1 + MAX_PRICE_DIFF)) {
      return 0.05; // Почти полное отсечение
   }

   if (price <= minPrice) {
      return 1.0;
   }

   const ratio = (price - minPrice) / (minPrice * MAX_PRICE_DIFF);
   return 1.0 - (0.95 * ratio);
}

function amountWeight(amount: number): number {
   const MIN_AMOUNT = 20000;
   const OPTIMAL_START = 50000;
   const OPTIMAL_END = 95000;
   const MAX_AMOUNT = 100000;

   // Штрафуем мелочь, но не убиваем в ноль (фильтр будет снаружи)
   if (amount < MIN_AMOUNT) {
      // Линейный рост от 0.1 (при 0) до 0.3 (при 20к)
      return 0.1 + (0.2 * (amount / MIN_AMOUNT));
   }

   if (amount >= MAX_AMOUNT) return 0;

   // От 20k до 50k - рост от 0.3 до 1.0
   if (amount < OPTIMAL_START) {
      const ratio = (amount - MIN_AMOUNT) / (OPTIMAL_START - MIN_AMOUNT);
      return 0.3 + (0.7 * ratio);
   }

   // От 50k до 95k - топ
   if (amount <= OPTIMAL_END) return 1.0;

   // От 95k до 100k - падение
   const ratio = (MAX_AMOUNT - amount) / (MAX_AMOUNT - OPTIMAL_END);
   return 1.0 * ratio;
}

export function paymentWeight(ad: Ad, card: Card): number {
   const banks = availableBanks(ad.remark);
   const isSberAd = (banks.includes("Сбербанк") || banks.includes("*"));
   const isUniversalAd = (banks.includes("*"));

   if (card.bank === "sber" && isSberAd) return 1.0;
   if (card.bank === "tbank" && !isSberAd) return 0.8;
   if (card.bank === "tbank" && isUniversalAd) return 0.7;

   return 0;
}

export function canUseCard(card: Card, ad: Ad | OrderPayload, remarkFromTG?: string): boolean {
   let amount: number;
   const usageData = getCardUsageData();
   const lastUsedTime = usageData[card.id];

   if (lastUsedTime) {
      const timeDiff = Date.now() - lastUsedTime;
      if (timeDiff < COOLDOWN_TIME) return false;
   }

   if ("maxAmount" in ad) {
      amount = parseFloat(ad.maxAmount);
      if (isNaN(amount)) return false;
      
      if (card.balance - amount < 10_000) return false;
      if (card.turnover + amount > 100_000) return false;
      return paymentWeight(ad, card) > 0;
   } else {
      // Логика для продажи (OrderPayload) осталась прежней
      if (!remarkFromTG) {
         const curAds: Ad[] = JSON.parse(localStorage.getItem("curAds") || "[]");
         remarkFromTG = curAds.find((a) => a.id === ad.itemId)?.remark;
      }
      let banks: string[] = ["*"];
      if (remarkFromTG) banks = availableBanksSell(remarkFromTG);

      if ((!banks.includes("Тинькофф") && !banks.includes("*")) && card.bank === "tbank") return false;
      if ((!banks.includes("Сбербанк") && !banks.includes("*")) && card.bank === "sber") return false;

      amount = parseFloat(ad.amount);
      if (isNaN(amount)) return false;
      if (card.turnover + amount > 100_000) return false;
   }
   return true;
}

export function markCardAsUsed(cardId: string): void {
   const usageData = getCardUsageData();
   const now = Date.now();
   localStorage.setItem("tradingModalCooldown", now.toString());
   usageData[cardId] = now;
   setCardUsageData(usageData);
}

// ==== Calculate Value ====
export function calculateValue(ad: Ad, card: Card, minPrice: number): number {
   const price = parseFloat(ad.price);
   const amount = parseFloat(ad.maxAmount);

   const wPrice = priceWeight(price, minPrice);
   const wAmount = amountWeight(amount);
   const wPayment = paymentWeight(ad, card);

   // Убрал жесткую проверку wAmount === 0, так как <20к теперь возвращает >0
   // Но оставил проверку на критические нули (цена и банк)
   if (wPrice === 0 || wPayment === 0) {
      return 0;
   }

   const priceCoef = 0.50;
   const amountCoef = 0.40;
   const paymentCoef = 0.10;

   return wPrice * priceCoef + wPayment * paymentCoef + wAmount * amountCoef;
}