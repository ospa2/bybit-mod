import type { FetchReviewsResult, Review } from "../../../shared/types/reviews";

export async function fetchReviewsData(
   userId: string
): Promise<FetchReviewsResult> {
   // ============================================
   // ЭТАП 1: Первичные запросы (2 параллельно)
   // ============================================

   const initialBadReviewsRequest = fetch(
      "https://www.bybit.com/x-api/fiat/otc/order/appraiseList",
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            makerUserId: userId,
            page: "1",
            size: "10",
            appraiseType: "0",
         }),
      }
   ).then((res) => res.json());



   const positiveReviewsRequest = fetch(
      "https://www.bybit.com/x-api/fiat/otc/order/appraiseList",
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            makerUserId: userId,
            page: "1",
            size: "1",
            appraiseType: "1",
         }),
      }
   ).then((res) => res.json());

   const [initialBadReviews, positiveJson] = await Promise.all([
      initialBadReviewsRequest,
      positiveReviewsRequest,
   ]);

   const totalCount = initialBadReviews.result?.count || 0;
   const foldingCount = initialBadReviews.result?.foldingCount || 0;

   // ============================================
   // ЭТАП 2: Условные дополнительные запросы
   // ============================================

   const additionalRequests: Promise<any>[] = [];

   // Дополнительные страницы обычных отзывов (если count > 10)
   if (totalCount > 10) {
      const totalPages = Math.ceil(totalCount / 10);
      for (let page = 2; page <= totalPages; page++) {
         additionalRequests.push(
            fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                  makerUserId: userId,
                  page: page.toString(),
                  size: "10",
                  appraiseType: "0",
               }),
            }).then((res) => res.json())
         );
      }
   }

   // Скрытые отзывы (если foldingCount > 0)
   if (foldingCount > 0) {
      const hiddenPages = Math.ceil(foldingCount / 10);
      for (let page = 1; page <= hiddenPages; page++) {
         additionalRequests.push(
            fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                  makerUserId: userId,
                  page: page.toString(),
                  size: "10",
                  appraiseType: "0",
                  foldingDisplay: "1",
               }),
            }).then((res) => res.json())
         );
      }
   }

   // Выполняем дополнительные запросы параллельно (если они есть)
   const additionalResults = additionalRequests.length > 0
      ? await Promise.all(additionalRequests)
      : [];

   // ============================================
   // Обработка результатов
   // ============================================

   // Объединяем все отзывы
   const allReviews = [initialBadReviews, ...additionalResults].flatMap(
      (json) => json.result?.appraiseInfoVo ?? []
   );

   // Уникализируем по id
   const uniqueReviews: Review[] = Array.from(
      new Map(allReviews.map((r: Review) => [r.id, r])).values()
   );

   // Сортировка по дате (новые первыми)
   const negativeReviews = uniqueReviews.sort(
      (a, b) => Number(b.updateDate) - Number(a.updateDate)
   );

   return {
      negativeReviews,
      positiveReviewsCount: positiveJson.result?.count || 0,
   };
}

export async function fetchBalance() {
   try {
      const res = await fetch(
         "https://www.bybit.com/x-api/fiat/otc/user/availableBalance",
         {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tokenId: "USDT" }),
         });
      const balanceJson = await res.json();

      return balanceJson.result[0]?.withdrawAmount
      
   } catch (error) {

   }
}