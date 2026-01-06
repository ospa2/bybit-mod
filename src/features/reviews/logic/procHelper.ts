import type { ReviewStats } from "../../../shared/types/reviews";

export function calculatePriority(user: Pick<ReviewStats, "goodReviewsCount" | "highlightedCount">): number {
   if (user.highlightedCount > 2) return 0;
   const likePart = user.goodReviewsCount < 150 ? user.goodReviewsCount / 3 : 50;
   const badPart = user.highlightedCount * 25;
   const priority = likePart + badPart;
   return Math.max(0, Math.min(100, Math.round(priority)));
}

// Интервал (в днях) = 300 / priority
function getRefreshIntervalDays(priority: number): number {
   if (!priority || priority <= 0) return Infinity;
   return 300 / priority;
}

// Нужно ли обновлять контрагента
export function shouldRefresh(user: ReviewStats): boolean {
   const last = user.lastUpdated || 0;
   const priority = user.priority ?? calculatePriority(user);
   const intervalDays = getRefreshIntervalDays(priority);
   if (!isFinite(intervalDays)) return false;

   const msSince = Date.now() - last;
   return msSince >= intervalDays * 24 * 60 * 60 * 1000;
}