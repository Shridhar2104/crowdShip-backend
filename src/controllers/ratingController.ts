import { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { 
    addRating as addRatingService, 
    getRatingById as getRatingByIdService, 
    updateRating as updateRatingService, 
    deleteRating as deleteRatingService,
    getUserRatings as getUserRatingsService, 
    getPackageRatings as getPackageRatingsService, 
    getRatingsByUser as getRatingsByUserService,
    getUnreviewedRatings as getUnreviewedRatingsService, 
    hasUserRatedPackage,
    getRatings as getRatingsService
  } from '../models/RatingService';
import { 
  Rating, RatingType, isValidRatingScore, calculateRatingSummary,
  prepareRatingData, prepareRatingReport, sanitizeRating
} from '../models/Rating';
import { 
  getDocument, queryDocuments, updateDocument, createDocument 
} from '../config/database';

// Collection names
const RATINGS_COLLECTION = 'ratings';
const PACKAGES_COLLECTION = 'packages';
const MATCHES_COLLECTION = 'matches';
const USERS_COLLECTION = 'users';
const REPORTS_COLLECTION = 'reports';

/**
 * Create a new rating
 * @route POST /api/v1/ratings
 * @access Private
 */
export const createRating = async (req: Request, res: Response) => {
  try {
    const { packageId, score, comment, type, isAnonymous = false, tags = [] } = req.body;
    const fromUserId = req.user?.id;
    
    // Validate required fields
    if (!packageId || score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Package ID and score are required'
      });
    }
    
    // Validate score
    if (!isValidRatingScore(score)) {
      return res.status(400).json({
        success: false,
        message: 'Score must be an integer between 1 and 5'
      });
    }
    
    // Get package details
    const packageDoc = await getDocument(PACKAGES_COLLECTION, packageId);
    if (!packageDoc) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }
    
    // Determine rating type and recipient
    let toUserId: string;
    let ratingType: RatingType;
    
    if (type) {
      // If type is explicitly provided, validate it
      if (!Object.values(RatingType).includes(type as RatingType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid rating type'
        });
      }
      ratingType = type as RatingType;
      
      // Validate that user can create this type of rating
      if (
        (ratingType === RatingType.SENDER_TO_CARRIER && req.user?.role !== 'sender') ||
        (ratingType === RatingType.CARRIER_TO_SENDER && req.user?.role !== 'carrier') ||
        (ratingType.startsWith('system_') && req.user?.role !== 'admin')
      ) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to create this type of rating'
        });
      }
    } else {
      // Infer type based on user role
      if (req.user?.role === 'sender') {
        ratingType = RatingType.SENDER_TO_CARRIER;
      } else if (req.user?.role === 'carrier') {
        ratingType = RatingType.CARRIER_TO_SENDER;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Rating type is required for this user role'
        });
      }
    }
    
    // Get match to determine the other party
    const matches = await queryDocuments(MATCHES_COLLECTION, [
      ['packageId', '==', packageId],
      ['status', '==', 'completed']
    ]);
    
    if (matches.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No completed match found for this package'
      });
    }
    
    const match = matches[0];
    
    // Determine recipient based on type
    if (ratingType === RatingType.SENDER_TO_CARRIER) {
      toUserId = match.carrierId;
      // Verify sender is the package sender
      if (packageDoc.senderId !== fromUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only rate packages you sent'
        });
      }
    } else if (ratingType === RatingType.CARRIER_TO_SENDER) {
      toUserId = packageDoc.senderId;
      // Verify carrier is the package carrier
      if (match.carrierId !== fromUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only rate packages you delivered'
        });
      }
    } else {
      // System ratings require admin and explicit toUserId
      if (!req.body.toUserId) {
        return res.status(400).json({
          success: false,
          message: 'Recipient user ID is required for system ratings'
        });
      }
      toUserId = req.body.toUserId;
    }
    
  // Check if fromUserId exists (which it should in your case)
if (!fromUserId) {
    return res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
  }
  
  // Now use it safely - TypeScript knows it's defined
  const hasRated = await hasUserRatedPackage(fromUserId, packageId, ratingType);
    
    // Create the rating
    const ratingData = prepareRatingData({
      packageId,
      fromUserId,
      toUserId,
      type: ratingType,
      score,
      comment,
      isAnonymous,
      tags,
      isReviewed: false,
      isHidden: false
    });
    
    const newRating = await addRatingService(ratingData);
    
    res.status(201).json({
      success: true,
      data: newRating
    });
  } catch (error) {
    console.error('Error creating rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating rating',
      error: (error as Error).message
    });
  }
};

/**
 * Get all ratings (admin only)
 * @route GET /api/v1/ratings
 * @access Private (admin)
 */
export const getAllRatings = async (req: Request, res: Response) => {
  try {
    const { 
      type, 
      minScore, 
      maxScore, 
      unreviewed, 
      limit: queryLimit = 50, 
      page = 1 
    } = req.query;
    
    const filters = {
      type: type as RatingType | undefined,
      minScore: minScore ? parseInt(minScore as string) : undefined,
      maxScore: maxScore ? parseInt(maxScore as string) : undefined,
      isReviewed: unreviewed === 'true' ? false : undefined
    };
    
    const pagination = {
      page: parseInt(page as string),
      limit: parseInt(queryLimit as string)
    };
    
    const ordering = {
      field: 'createdAt',
      direction: 'desc' as 'asc' | 'desc'
    };
    
    const result = await getRatingsService(filters, pagination, ordering);
    
    res.status(200).json({
      success: true,
      data: result.ratings,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error getting ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving ratings',
      error: (error as Error).message
    });
  }
};

/**
 * Get current user's received ratings
 * @route GET /api/v1/ratings/me
 * @access Private
 */
export const getUserRatings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { type } = req.query;
    
    let ratingType: RatingType | undefined;
    if (type && Object.values(RatingType).includes(type as RatingType)) {
      ratingType = type as RatingType;
    }
    
    const ratings = await getUserRatingsService(userId!, ratingType);
    
    // Sanitize ratings for anonymous ones
    const sanitizedRatings = ratings.map(rating => sanitizeRating(rating, req.user?.id));
    
    res.status(200).json({
      success: true,
      data: sanitizedRatings
    });
  } catch (error) {
    console.error('Error getting user ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user ratings',
      error: (error as Error).message
    });
  }
};

/**
 * Get ratings given by current user
 * @route GET /api/v1/ratings/given
 * @access Private
 */
export const getGivenRatings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const ratings = await getRatingsByUserService(userId!);
    
    res.status(200).json({
      success: true,
      data: ratings
    });
  } catch (error) {
    console.error('Error getting given ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving given ratings',
      error: (error as Error).message
    });
  }
};

/**
 * Get rating by ID
 * @route GET /api/v1/ratings/:id
 * @access Private
 */
export const getRatingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    const rating = await getRatingByIdService(id);
    
    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    // Check access permissions
    // Admin can view all
    // Users can view ratings they gave or received
    // Or public ratings (not hidden)
    if (
      userRole !== 'admin' && 
      rating.fromUserId !== userId && 
      rating.toUserId !== userId && 
      rating.isHidden
    ) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this rating'
      });
    }
    
    // Sanitize rating if needed
    const sanitizedRating = sanitizeRating(
      rating, 
      userRole === 'admin' ? 'admin' : userId
    );
    
    res.status(200).json({
      success: true,
      data: sanitizedRating
    });
  } catch (error) {
    console.error('Error getting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving rating',
      error: (error as Error).message
    });
  }
};

/**
 * Update a rating (admin or rating author)
 * @route PUT /api/v1/ratings/:id
 * @access Private
 */
export const updateRating = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    let updates = req.body;
    
    // Get current rating
    const rating = await getRatingByIdService(id);
    
    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    // Check authorization
    // Only the rating author or admin can update
    if (userRole !== 'admin' && rating.fromUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this rating'
      });
    }
    
    // Regular users can only update certain fields
    if (userRole !== 'admin') {
      // Only allow regular users to update comment, score, and isAnonymous
      const { comment, score, isAnonymous } = updates;
      updates = { comment, score, isAnonymous };
      
      // Validate score if provided
      if (score !== undefined && !isValidRatingScore(score)) {
        return res.status(400).json({
          success: false,
          message: 'Score must be an integer between 1 and 5'
        });
      }
    }
    
    // Perform update
    const updatedRating = await updateRatingService(id, updates);
    
    if (!updatedRating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedRating
    });
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating rating',
      error: (error as Error).message
    });
  }
};

/**
 * Delete a rating (admin only)
 * @route DELETE /api/v1/ratings/:id
 * @access Private (admin)
 */
export const deleteRating = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const success = await deleteRatingService(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Rating deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting rating',
      error: (error as Error).message
    });
  }
};

/**
 * Get ratings for a specific user
 * @route GET /api/v1/ratings/user/:userId
 * @access Private
 */
export const getUserRatingsById = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;
    const requestingUserId = req.user?.id;
    const userRole = req.user?.role;
    
    // Check if user exists
    const user = await getDocument(USERS_COLLECTION, userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    let ratingType: RatingType | undefined;
    if (type && Object.values(RatingType).includes(type as RatingType)) {
      ratingType = type as RatingType;
    }
    
    // Include hidden ratings only for admins
    const includeHidden = userRole === 'admin';
    
    const ratings = await getUserRatingsService(userId, ratingType, includeHidden);
    
    // Sanitize ratings to respect anonymity
    const sanitizedRatings = ratings.map(rating => 
      sanitizeRating(rating, userRole === 'admin' ? 'admin' : requestingUserId)
    );
    
    res.status(200).json({
      success: true,
      data: sanitizedRatings
    });
  } catch (error) {
    console.error('Error getting user ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user ratings',
      error: (error as Error).message
    });
  }
};

/**
 * Get ratings for a specific package
 * @route GET /api/v1/ratings/package/:packageId
 * @access Private
 */
export const getPackageRatings = async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const requestingUserId = req.user?.id;
    const userRole = req.user?.role;
    
    // Check if package exists
    const packageDoc = await getDocument(PACKAGES_COLLECTION, packageId);
    if (!packageDoc) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }
    
    const ratings = await getPackageRatingsService(packageId);
    
    // Sanitize ratings to respect anonymity
    const sanitizedRatings = ratings.map(rating => 
      sanitizeRating(rating, userRole === 'admin' ? 'admin' : requestingUserId)
    );
    
    res.status(200).json({
      success: true,
      data: sanitizedRatings
    });
  } catch (error) {
    console.error('Error getting package ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving package ratings',
      error: (error as Error).message
    });
  }
};

/**
 * Report an inappropriate rating
 * @route POST /api/v1/ratings/:id/report
 * @access Private
 */
export const reportRating = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, details } = req.body;
    const userId = req.user?.id;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for report is required'
      });
    }
    
    // Check if rating exists
    const rating = await getRatingByIdService(id);
    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    // Create report
    const reportData = prepareRatingReport(id, userId!, reason, details);
    
    const reportId = await createDocument(REPORTS_COLLECTION, reportData);
    
    // Update rating to mark it has been reported
    await updateRatingService(id, {
      isReviewed: false
    });
    
    res.status(200).json({
      success: true,
      message: 'Rating reported successfully',
      data: {
        reportId
      }
    });
  } catch (error) {
    console.error('Error reporting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error reporting rating',
      error: (error as Error).message
    });
  }
};

/**
 * Admin review of a rating
 * @route POST /api/v1/ratings/:id/review
 * @access Private (admin)
 */
export const reviewRating = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, adminNotes, isHidden } = req.body;
    const adminId = req.user?.id;
    
    if (approved === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Approval status is required'
      });
    }
    
    // Check if rating exists
    const rating = await getRatingByIdService(id);
    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }
    
    // Update rating with review result
    const updates: Partial<Rating> = {
      isReviewed: true,
      adminNotes: adminNotes || rating.adminNotes
    };
    
    // If not approved, hide the rating
    if (!approved) {
      updates.isHidden = true;
    } else if (isHidden !== undefined) {
      updates.isHidden = isHidden;
    }
    
    const updatedRating = await updateRatingService(id, updates);
    
    // Update any pending reports for this rating
    const reports = await queryDocuments(REPORTS_COLLECTION, [
      ['ratingId', '==', id],
      ['status', '==', 'pending']
    ]);
    
    // Update all pending reports
    const updatePromises = reports.map(report => 
      updateDocument(REPORTS_COLLECTION, report.id, {
        status: approved ? 'rejected' : 'approved',
        reviewedAt: Timestamp.now(),
        reviewedBy: adminId
      })
    );
    
    await Promise.all(updatePromises);
    
    res.status(200).json({
      success: true,
      message: `Rating has been ${approved ? 'approved' : 'rejected'}`,
      data: updatedRating
    });
  } catch (error) {
    console.error('Error reviewing rating:', error);
    res.status(500).json({
      success: false,
      message: 'Error reviewing rating',
      error: (error as Error).message
    });
  }
};

/**
 * Get rating summary for a user
 * @route GET /api/v1/ratings/summary/user/:userId
 * @access Private
 */
export const getUserRatingSummary = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;
    const userRole = req.user?.role;
    
    // Check if user exists
    const user = await getDocument(USERS_COLLECTION, userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get all ratings for this user
    const ratings = await getUserRatingsService(userId, undefined, false);
    
    // Sanitize the ratings in the summary to respect anonymity
    const sanitizedRatings = ratings.map(rating => 
      sanitizeRating(rating, userRole === 'admin' ? 'admin' : requestingUserId)
    );
    
    // Generate summary
    const summary = calculateRatingSummary(userId, sanitizedRatings);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting rating summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving rating summary',
      error: (error as Error).message
    });
  }
};