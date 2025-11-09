import { upsertStats } from "../../../shared/storage/storageHelper";
import type { Ad } from "../../../shared/types/ads";
import type { ReviewStats } from "../../../shared/types/reviews";
import { fetchReviewsData } from "../api/reviewsApi";
import { calculatePriority } from "./procHelper";
import { analyzeReview } from "./reviewAnalyzer";

export async function processUserReviews(originalAd: Ad | string): Promise<void> {
   if (typeof originalAd === "string") originalAd = { userId: originalAd } as Ad;
   try {
      const { negativeReviews, positiveReviewsCount } = await fetchReviewsData(originalAd.userId);

      let highlightedCount = 0;
      for (const review of negativeReviews) {
         if (!review.appraiseContent) continue;
         const analysis = analyzeReview(review.appraiseContent);
         if (analysis.shouldHighlight) highlightedCount++;
      }

      const badReviewsCount = negativeReviews.length;
      const goodReviewsCount = Number(positiveReviewsCount || 0);

      let entry: ReviewStats = {
         userId: originalAd.userId,
         goodReviewsCount,
         badReviewsCount,
         highlightedCount,
         lastUpdated: Date.now(),
         priority: 0
      };

      entry.priority = calculatePriority(entry);

      upsertStats(entry);
   } catch (err) {
      console.warn("processUserReviews error for", originalAd.userId, err);
   }
}
