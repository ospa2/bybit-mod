import { LS_KEY } from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import type { ReviewStats } from "../../../shared/types/reviews";
import { shouldRefresh } from "../../reviews/logic/procHelper";
import { processUserReviews } from "../../reviews/logic/reviewProcessor";

function delay(ms: number) {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

let isBackgroundProcessRunning = false;

export async function backgroundProcessAds(): Promise<void> {

   const newSellersAdsRaw = localStorage.getItem("unknownUserIds") || "[]";
   const newSellersAds: Ad[] = JSON.parse(newSellersAdsRaw);

   if (isBackgroundProcessRunning) {
      console.log("⚠ backgroundProcessAds уже выполняется, новый запуск отменён");
      return;
   }
   isBackgroundProcessRunning = true;

   try {
      // 1️⃣ Новые продавцы — обрабатываем всех
      for (const ad of newSellersAds) {
         await processUserReviews(ad);

         // удаляем обработанного
         const current = JSON.parse(localStorage.getItem("unknownUserIds") || "[]") as Ad[];
         const next = current.filter(item => item.userId !== ad.userId);
         localStorage.setItem("unknownUserIds", JSON.stringify(next));

         await delay(1000); // пауза для безопасности
      }


      // 2️⃣ Уже известные продавцы — обновляем только при необходимости
      const storedStats = (JSON.parse(localStorage.getItem(LS_KEY) || "[]") as any[]).filter((x): x is ReviewStats => x !== null).sort((a, b) => b.priority - a.priority);

      for (const stat of storedStats) {
         
         if (stat) {
            if (stat.priority === 0) continue; // больше не интересен
            if (!shouldRefresh(stat)) continue; // ещё не пора
         }

         await processUserReviews(stat.userId);
         
         await delay(1000);
      }
   } finally {
      isBackgroundProcessRunning = false;
   }
}