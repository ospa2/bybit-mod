import type { FetchReviewsResult, Review } from "../../../shared/types/reviews";

export async function fetchReviewsData(
   userId: string
): Promise<FetchReviewsResult> {
   const pageNumbers = Array.from({ length: 7 }, (_, i) => i + 1);

   // Запросы обычных и скрытых отзывов
   const reviewRequests = pageNumbers.map((page) => {
      const payload = {
         makerUserId: userId,
         page: page.toString(),
         size: "10",
         appraiseType: "0",
      };
      return fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
      }).then((res) => res.json());
   });

   const hiddenReviewRequests = pageNumbers.map((page) => {
      const payload = {
         makerUserId: userId,
         page: page.toString(),
         size: "10",
         appraiseType: "0",
         foldingDisplay: "1",
      };
      return fetch("https://www.bybit.com/x-api/fiat/otc/order/appraiseList", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(payload),
      }).then((res) => res.json());
   });

   // Баланс
   const balanceRequest = fetch(
      "https://www.bybit.com/x-api/fiat/otc/user/availableBalance",
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ tokenId: "USDT" }),
      }
   ).then((res) => res.json());

   // Количество положительных отзывов
   const positiveReviewsRequest = fetch(
      "https://www.bybit.com/x-api/fiat/otc/order/appraiseList",
      {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            makerUserId: userId,
            page: "1",
            size: "1", // достаточно 1, чтобы получить count
            appraiseType: "1",
         }),
      }
   ).then((res) => res.json());

   // Выполняем ВСЁ параллельно
   const [reviewsResults, hiddenResults, balanceJson, positiveJson] =
      await Promise.all([
         Promise.all(reviewRequests),
         Promise.all(hiddenReviewRequests),
         balanceRequest,
         positiveReviewsRequest,
      ]);

   // Объединяем обычные и скрытые отзывы
   const allReviews = [...reviewsResults, ...hiddenResults].flatMap(
      (json) => json.result?.appraiseInfoVo ?? []
   );

   // Уникализируем (лучше по id, а не по ссылке на объект)
   const uniqueReviews: Review[] = Array.from(
      new Map(allReviews.map((r: Review) => [r.id, r])).values()
   );

   // Сортировка по дате
   const negativeReviews = uniqueReviews.sort(
      (a, b) => Number(b.updateDate) - Number(a.updateDate)
   );

   return {
      negativeReviews,
      positiveReviewsCount: positiveJson.result?.count || 0,
      currentBalance: balanceJson.result[0]?.withdrawAmount || 0,
   };
}