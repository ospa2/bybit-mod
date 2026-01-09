import type { ReviewStats } from "../../../shared/types/reviews";
import { fetchReviewsData } from "../api/reviewsApi";
import { calculatePriority } from "./procHelper";
import { analyzeReview } from "./reviewAnalyzer";

// ==========================================
// 1. Чистая функция обработки (не пишет в Storage)
// ==========================================
export async function processUserReviewsPure(userId: string): Promise<ReviewStats | null> {
   try {
      // Запускаем сетевой запрос
      const { negativeReviews, positiveReviewsCount } = await fetchReviewsData(userId);

      let highlightedCount = 0;
      // Оптимизация: for..of быстрее на больших массивах, но если review огромные - можно ограничить длину анализа
      for (const review of negativeReviews) {
         if (review.appraiseContent && analyzeReview(review.appraiseContent).shouldHighlight) {
            highlightedCount++;
         }
      }

      const entry: ReviewStats = {
         userId,
         goodReviewsCount: Number(positiveReviewsCount || 0),
         badReviewsCount: negativeReviews.length,
         highlightedCount,
         lastUpdated: Date.now(),
         priority: 0 // Приоритет пересчитаем позже массово
      };

      // Переносим расчет приоритета сюда, если он зависит только от данных юзера
      entry.priority = calculatePriority(entry);

      return entry;
   } catch (err) {
      console.warn(`Failed to process ${userId}:`, err);
      return null;
   }
}
