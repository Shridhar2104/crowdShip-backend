import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Rating type enum
export enum RatingType {
  SENDER_TO_CARRIER = 'sender_to_carrier',   // Sender rating carrier
  CARRIER_TO_SENDER = 'carrier_to_sender',   // Carrier rating sender
  SYSTEM_TO_CARRIER = 'system_to_carrier',   // Automatic system rating for carrier
  SYSTEM_TO_SENDER = 'system_to_sender'      // Automatic system rating for sender
}

// Rating interface
export interface Rating {
  id: string;
  packageId: string;
  fromUserId: string;  // User who gave the rating
  toUserId: string;    // User who received the rating
  type: RatingType;
  score: number;       // Rating score (1-5)
  comment?: string;    // Optional comment with the rating
  isAnonymous: boolean;// Whether the rating is anonymous
  tags?: string[];     // Array of tags/categories for the rating (note: stored directly as array in Firestore)
  isReviewed: boolean; // Whether the rating has been reviewed by admins
  isHidden: boolean;   // Whether the rating is hidden from public view
  adminNotes?: string; // Admin notes about this rating
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

// Report interface for rating reports
export interface RatingReport {
  id: string;
  ratingId: string;
  reportedBy: string;
  reason: string;
  details?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

// Rating summary interface for user rating statistics
export interface RatingSummary {
  userId: string;
  averageScore: number;
  totalRatings: number;
  scoreDistribution: Record<number, number>;
  ratingsByType: Record<string, number>;
  recentRatings: Rating[];
}

/**
 * Prepare rating data for creation
 * Note: createdAt and updatedAt will be set by the createDocument function
 */
export function prepareRatingData(ratingData: Omit<Rating, 'id' | 'createdAt' | 'updatedAt'>): Omit<Rating, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    ...ratingData,
    // Default values
    isAnonymous: ratingData.isAnonymous ?? false,
    isReviewed: ratingData.isReviewed ?? false,
    isHidden: ratingData.isHidden ?? false,
    // If tags is undefined, set it to empty array
    tags: ratingData.tags || []
  };
}

/**
 * Validate a rating score (1-5)
 */
export function isValidRatingScore(score: number): boolean {
  return score >= 1 && score <= 5 && Number.isInteger(score);
}

/**
 * Check if a rating is valid for submission
 */
export function isValidRating(rating: Partial<Rating>): boolean {
  // Required fields
  if (!rating.packageId || !rating.fromUserId || !rating.toUserId || !rating.type || rating.score === undefined) {
    return false;
  }
  
  // Score validation
  if (!isValidRatingScore(rating.score)) {
    return false;
  }
  
  return true;
}

/**
 * Create a report for an inappropriate rating
 */
export function prepareRatingReport(
  ratingId: string, 
  reportedBy: string, 
  reason: string, 
  details?: string
): Omit<RatingReport, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    ratingId,
    reportedBy,
    reason,
    details,
    status: 'pending'
  };
}

/**
 * Filter out sensitive information for anonymous ratings
 */
export function sanitizeRating(rating: Rating, forUserId?: string): Rating {
  // Don't sanitize for admins, the rating author, or the recipient
  if (
    forUserId === 'admin' || 
    forUserId === rating.fromUserId || 
    forUserId === rating.toUserId
  ) {
    return rating;
  }
  
  // If rating is anonymous, remove the author ID
  if (rating.isAnonymous) {
    return {
      ...rating,
      fromUserId: 'anonymous'
    };
  }
  
  return rating;
}

/**
 * Calculate a rating summary for a user
 */
export function calculateRatingSummary(userId: string, ratings: Rating[]): RatingSummary {
  if (ratings.length === 0) {
    return {
      userId,
      averageScore: 0,
      totalRatings: 0,
      scoreDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
      },
      ratingsByType: {
        [RatingType.SENDER_TO_CARRIER]: 0,
        [RatingType.CARRIER_TO_SENDER]: 0,
        [RatingType.SYSTEM_TO_CARRIER]: 0,
        [RatingType.SYSTEM_TO_SENDER]: 0
      },
      recentRatings: []
    };
  }
  
  // Calculate average score
  const totalScore = ratings.reduce((sum, rating) => sum + rating.score, 0);
  const averageScore = totalScore / ratings.length;
  
  // Get score distribution
  const scoreDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };
  
  ratings.forEach(rating => {
    scoreDistribution[rating.score as keyof typeof scoreDistribution]++;
  });
  
  // Get most recent ratings
  // Sort by createdAt, handling that it might be a Timestamp or a FieldValue
  const recentRatings = [...ratings]
    .sort((a, b) => {
      // Handle if createdAt is a Timestamp
      if ('toMillis' in a.createdAt && 'toMillis' in b.createdAt) {
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      }
      // Default to keeping the original order if we can't compare
      return 0;
    })
    .slice(0, 5);
  
  // Get ratings by type
  const ratingsByType = Object.values(RatingType).reduce((acc, type) => {
    acc[type] = ratings.filter(r => r.type === type).length;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    userId,
    averageScore,
    totalRatings: ratings.length,
    scoreDistribution,
    ratingsByType,
    recentRatings
  };
}