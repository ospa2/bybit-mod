export interface ReviewStats {
  userId: string;
  goodReviewsCount: number;
  badReviewsCount: number;
  highlightedCount: number;
  lastUpdated: number;
  priority: number;
}
export interface Review {
  anonymous: number;
  nickName: string;
  appraiseType: string;
  appraiseContent: string;
  updateDate: string;
  authStatus: string;
  id: string;
  userPrivilege: string[];
}

export type FetchReviewsResult = {
  negativeReviews: Review[];
  positiveReviewsCount: number;
  currentBalance: number;
};