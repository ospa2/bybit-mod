import reviewsStatistics from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import { fetchReviewsData } from "../api/reviewsApi";
import { analyzeReview } from "./reviewAnalyzer";

export async function processUserReviews(originalAd: Ad): Promise<void> {
   if (1) { //(!adShouldBeFiltered(originalAd)) {
      /*reviewsStatistics.getByUserId(originalAd.userId)===null*/ const {
         negativeReviews,
         positiveReviewsCount,
      } = await fetchReviewsData(originalAd.userId);
      console.log('negativereviewsCount:', negativeReviews.length);

      let highlightedCount = 0;

      negativeReviews.forEach((review) => {
         if (!review.appraiseContent) return;

         const analysis = analyzeReview(review.appraiseContent);

         if (analysis.shouldHighlight) {
            highlightedCount++;
         }
      });

      // --- СОХРАНЕНИЕ СТАТИСТИКИ ---
      const statsObject = {
         highlightedCount,
         goodReviewsCount: positiveReviewsCount,
         allReviewsLength: negativeReviews.length,
         userId: originalAd.userId,
      };
      console.log(originalAd.nickName);

      reviewsStatistics.add(statsObject);
   }
}