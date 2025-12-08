import { getCardUsageData, setCardUsageData } from "../../../shared/storage/storageHelper";
import type { Ad, OrderPayload } from "../../../shared/types/ads";
import type { Card } from "../../../shared/types/reviews";
import { availableBanks, availableBanksSell } from "../../../shared/utils/bankParser";

const COOLDOWN_TIME = 1_200_000; // 20 минут в миллисекундах


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


function paymentWeight(ad: Ad, card: Card): number {
   const banks = availableBanks(ad.remark)

   const isSberAd = (banks.includes("Сбербанк") || banks.includes("*"));
   const isUniversalAd = (banks.includes("*"));

   if (card.bank === "sber" && isSberAd) return 1.0;
   if (card.bank === "tbank" && !isSberAd) return 0.8;
   if (card.bank === "tbank" && isUniversalAd) return 0.7;

   return 0; // карта не подходит под способы оплаты
}


export function canUseCard(card: Card, ad: Ad | OrderPayload, remarkFromTG?: string): boolean {
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
      if (!remarkFromTG) {
         const curAds: Ad[] = JSON.parse(localStorage.getItem("curAds") || "[]");
         remarkFromTG = curAds.find((a) => a.id === ad.itemId)?.remark
         console.log("🚀 ~ canUseCard ~ remarkFromTG:", remarkFromTG)
      }

      let banks: string[] = ["*"]
      console.log("🚀 ~ canUseCard ~ remarkFromTG:", remarkFromTG)
      if (remarkFromTG) {
         banks = availableBanksSell(remarkFromTG)
      }
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
   localStorage.setItem("tradingModalCooldown", now.toString());// общее кд между ордерами чтобы не перегружаться; только для автоарбитража
   usageData[cardId] = Date.now();
   setCardUsageData(usageData);
}


// ==== Основная функция ====
export function calculateValue(ad: Ad, card: Card, minPrice: number): number {
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