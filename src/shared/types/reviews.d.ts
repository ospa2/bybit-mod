export interface ReviewStats {
  highlightedCount: number;
  goodReviewsCount: number;
  allReviewsLength: number;
  userId: string;
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