import { Timestamp } from 'firebase-admin/firestore';
import {
  createDocument,
  getDocument,
  updateDocument,
  queryDocuments,
  deleteDocument,
  setDocument
} from '../config/database';
import {
  Rating,
  RatingType,
  isValidRating,
  prepareRatingData
} from './Rating';

// Collection names
const RATINGS_COLLECTION = 'ratings';
const USERS_COLLECTION = 'users';
const PACKAGES_COLLECTION = 'packages';

/**
 * Create a new rating
 */
export async function addRating(ratingData: Omit<Rating, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rating> {
  // Validate rating data
  if (!isValidRating(ratingData)) {
    throw new Error('Invalid rating data');
  }
  
  // Check if package exists
  const packageDoc = await getDocument(PACKAGES_COLLECTION, ratingData.packageId);
  if (!packageDoc) {
    throw new Error(`Package with ID ${ratingData.packageId} not found`);
  }
  
  // Check if users exist
  const fromUser = await getDocument(USERS_COLLECTION, ratingData.fromUserId);
  if (!fromUser) {
    throw new Error(`User with ID ${ratingData.fromUserId} not found`);
  }
  
  const toUser = await getDocument(USERS_COLLECTION, ratingData.toUserId);
  if (!toUser) {
    throw new Error(`User with ID ${ratingData.toUserId} not found`);
  }
  
  // Prepare rating data with defaults
  const preparedData = prepareRatingData(ratingData);
  
  // Add to database (createDocument will handle timestamps)
  const ratingId = await createDocument(RATINGS_COLLECTION, preparedData);
  
  // Update user's average rating
  await updateUserRating(ratingData.toUserId);
  
  // Get the complete rating document
  const newRating = await getDocument(RATINGS_COLLECTION, ratingId);
  
  return newRating;
}

/**
 * Get a rating by ID
 */
export async function getRatingById(ratingId: string): Promise<Rating | null> {
  return getDocument(RATINGS_COLLECTION, ratingId);
}

/**
 * Update a rating
 */
export async function updateRating(
  ratingId: string, 
  updates: Partial<Rating>
): Promise<Rating | null> {
  // Get existing rating
  const rating = await getRatingById(ratingId);
  if (!rating) {
    return null;
  }
  
  // Cannot update certain fields
  const { id, fromUserId, toUserId, packageId, createdAt, updatedAt, ...validUpdates } = updates as any;
  
  // Update the rating
  await updateDocument(RATINGS_COLLECTION, ratingId, validUpdates);
  
  // If score was updated, update user's average rating
  if (updates.score !== undefined) {
    await updateUserRating(rating.toUserId);
  }
  
  // Get the updated rating
  return getRatingById(ratingId);
}

/**
 * Delete a rating
 */
export async function deleteRating(ratingId: string): Promise<boolean> {
  // Get the rating first to know which user to update
  const rating = await getRatingById(ratingId);
  if (!rating) {
    return false;
  }
  
  // Delete the rating
  await deleteDocument(RATINGS_COLLECTION, ratingId);
  
  // Update user's average rating
  await updateUserRating(rating.toUserId);
  
  return true;
}

/**
 * Get ratings for a user
 */
export async function getUserRatings(
  userId: string, 
  type?: RatingType, 
  includeHidden = false
): Promise<Rating[]> {
  // Build query
  const queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [
    ['toUserId', '==', userId]
  ];
  
  // Add type filter if provided
  if (type) {
    queries.push(['type', '==', type]);
  }
  
  // Filter out hidden ratings unless specifically included
  if (!includeHidden) {
    queries.push(['isHidden', '==', false]);
  }
  
  // Get ratings
  return queryDocuments(RATINGS_COLLECTION, queries, { field: 'createdAt', direction: 'desc' });
}

/**
 * Get ratings for a package
 */
export async function getPackageRatings(packageId: string): Promise<Rating[]> {
  return queryDocuments(RATINGS_COLLECTION, [
    ['packageId', '==', packageId],
    ['isHidden', '==', false]
  ]);
}

/**
 * Get ratings submitted by a user
 */
export async function getRatingsByUser(userId: string): Promise<Rating[]> {
  return queryDocuments(RATINGS_COLLECTION, [
    ['fromUserId', '==', userId]
  ]);
}

/**
 * Get unreviewed ratings (for admin)
 */
export async function getUnreviewedRatings(): Promise<Rating[]> {
  return queryDocuments(RATINGS_COLLECTION, [
    ['isReviewed', '==', false]
  ]);
}

/**
 * Check if a user has already rated a package
 */
export async function hasUserRatedPackage(
  userId: string, 
  packageId: string, 
  type: RatingType
): Promise<boolean> {
  const ratings = await queryDocuments(RATINGS_COLLECTION, [
    ['fromUserId', '==', userId],
    ['packageId', '==', packageId],
    ['type', '==', type]
  ]);
  
  return ratings.length > 0;
}

/**
 * Update a user's average rating
 * This is called whenever a rating is added, updated, or deleted
 */
async function updateUserRating(userId: string): Promise<void> {
  // Get all valid ratings for this user
  const ratings = await queryDocuments(RATINGS_COLLECTION, [
    ['toUserId', '==', userId],
    ['isHidden', '==', false]
  ]);
  
  if (ratings.length === 0) {
    // No ratings, set default values
    await updateDocument(USERS_COLLECTION, userId, {
      ratingAverage: 0,
      ratingCount: 0
    });
    return;
  }
  
  // Calculate average
  const totalScore = ratings.reduce((sum, rating) => sum + rating.score, 0);
  const averageScore = totalScore / ratings.length;
  
  // Update user
  await updateDocument(USERS_COLLECTION, userId, {
    ratingAverage: averageScore,
    ratingCount: ratings.length
  });
}

/**
 * Get a batch of ratings with pagination
 */
export async function getRatings(
  filters: {
    type?: RatingType;
    minScore?: number;
    maxScore?: number;
    isReviewed?: boolean;
  },
  pagination: {
    page?: number;
    limit?: number;
  },
  ordering?: {
    field: string;
    direction?: 'asc' | 'desc';
  }
): Promise<{
  ratings: Rating[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const { type, minScore, maxScore, isReviewed } = filters;
  const { page = 1, limit = 50 } = pagination;
  const orderBy = ordering || { field: 'createdAt', direction: 'desc' };
  
  // Build queries
  const queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [];
  
  if (type) {
    queries.push(['type', '==', type]);
  }
  
  if (minScore !== undefined) {
    queries.push(['score', '>=', minScore]);
  }
  
  if (maxScore !== undefined) {
    queries.push(['score', '<=', maxScore]);
  }
  
  if (isReviewed !== undefined) {
    queries.push(['isReviewed', '==', isReviewed]);
  }
  
  // Get all matching ratings to determine total count
  // Note: In a production app with many ratings, you might want a more efficient approach
  const allRatings = await queryDocuments(RATINGS_COLLECTION, queries);
  const total = allRatings.length;
  
  // Apply pagination and ordering
  const ratings = await queryDocuments(
    RATINGS_COLLECTION,
    queries,
    orderBy,
    limit
  );
  
  return {
    ratings: ratings.slice((page - 1) * limit, page * limit),
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit)
  };
}