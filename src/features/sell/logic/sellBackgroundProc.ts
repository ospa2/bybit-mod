import reviewsStatistics from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import { processUserReviews } from "../../reviews/logic/reviewProcessor";

function delay(ms: number) {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

let isBackgroundProcessRunning = false;

export async function backgroundProcessAds() {

   const newSellersAdsRaw = localStorage.getItem("unknownUserIds") || "[]";//объявления от новых продавцов
   const ads: Ad[] = JSON.parse(newSellersAdsRaw);
   if (isBackgroundProcessRunning) {
      console.log(
         "⚠ backgroundProcessAds уже выполняется, новый запуск отменён"
      );
      return;
   }
   isBackgroundProcessRunning = true;
   console.log("▶ Запущен backgroundProcessAds");

   try {
      const oldMerchantsAds = ads.filter(
         (ad) => reviewsStatistics.getByUserId(ad.userId) !== null
      );
      for (const ad of ads) {
         await processUserReviews(ad);
         const newValue = localStorage.getItem("unknownUserIds") || "[]";
         const newSellerAds: Ad[] = JSON.parse(newValue);


         const nextSellerAds = newSellerAds.filter((item: Ad) => item.userId !== ad.userId);

         localStorage.setItem("unknownUserIds", JSON.stringify(nextSellerAds));
         await delay(1000); // пауза 1 сек, чтобы не заблокировали IP
      }
      for (const ad of oldMerchantsAds) {
         await processUserReviews(ad);

         await delay(1000); // пауза 1 сек, чтобы не заблокировали IP
      }
   } finally {
      isBackgroundProcessRunning = false;
   }
}