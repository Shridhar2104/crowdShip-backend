import { Request, Response } from 'express';
import { db, Timestamp, queryDocuments, getDocument, createDocument, updateDocument } from '../config/database';
import { Match, MatchStatus } from '../models/Match';
import AIMatchingService from '../utils/intelligentMatchingService';
import CarbonEmissionService from '../utils/CarbonEmissionService';
import { logger } from '../utils/logger';

// Collection names
const MATCHES_COLLECTION = 'matches';
const PACKAGES_COLLECTION = 'packages';
const USERS_COLLECTION = 'users';

/**
 * Create a match manually (admin only)
 * @route POST /api/v1/matches
 * @access Private (admin)
 */
export const createMatch = async (req: Request, res: Response) => {
  try {
    const matchData = req.body;

    // Validate required fields
    if (!matchData.packageId || !matchData.carrierId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Package ID and Carrier ID are required' 
      });
    }

    // Verify package exists
    const packageDoc = await getDocument(PACKAGES_COLLECTION, matchData.packageId);
    if (!packageDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Package not found' 
      });
    }

    // Verify carrier exists
    const carrierDoc = await getDocument(USERS_COLLECTION, matchData.carrierId);
    if (!carrierDoc) {
      return res.status(404).json({ 
        success: false, 
        message: 'Carrier not found' 
      });
    }

    // Set default expiration time if not provided (24 hours from now)
    if (!matchData.expiresAt) {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 24);
      matchData.expiresAt = Timestamp.fromDate(expirationDate);
    }
    
    // Generate random pickup and delivery codes
    const carrierPickupCode = Math.floor(100000 + Math.random() * 900000).toString();
    const carrierDeliveryCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Create new match
    const matchId = await createDocument(MATCHES_COLLECTION, {
      ...matchData,
      carrierPickupCode,
      carrierDeliveryCode,
      status: MatchStatus.PENDING
    });
    
    // Get the newly created match
    const newMatch = await getDocument(MATCHES_COLLECTION, matchId);

    res.status(201).json({
      success: true,
      data: newMatch
    });
  } catch (error) {
    logger.error('Error creating match:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating match',
      error: (error as Error).message
    });
  }
};

/**
 * Get all matches (filtered by query params)
 * @route GET /api/v1/matches
 * @access Private
 */
export const getMatches = async (req: Request, res: Response) => {
  try {
    const { 
      status, carrierId, packageId, 
      limit: queryLimit = 10, 
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc' 
    } = req.query;

    const pageSize = parseInt(queryLimit as string);
    const pageNumber = parseInt(page as string);
    
    // Build queries array for queryDocuments
    const queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [];
    
    // Apply filters
    if (status) {
      queries.push(['status', '==', status]);
    }
    
    if (carrierId) {
      queries.push(['carrierId', '==', carrierId]);
    }
    
    if (packageId) {
      queries.push(['packageId', '==', packageId]);
    }
    
    // Apply sorting and pagination
    const orderByOption = {
      field: sortBy as string || 'createdAt',
      direction: (sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'
    };
    
    // Execute query
    let allMatches = await queryDocuments(
      MATCHES_COLLECTION,
      queries,
      orderByOption
    );
    
    // Apply manual pagination (not efficient for large datasets but works for demo)
    const matches = allMatches.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    const totalCount = allMatches.length;
    
    res.status(200).json({
      success: true,
      data: matches,
      pagination: {
        total: totalCount,
        page: pageNumber,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    logger.error('Error getting matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving matches',
      error: (error as Error).message
    });
  }
};

/**
 * Get current user's matches
 * @route GET /api/v1/matches/me
 * @access Private
 */
export const getUserMatches = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated or role not defined' 
      });
    }
    
    let matches = [];
    
    // For carriers - filter by carrierId
    if (userRole === 'carrier') {
      matches = await queryDocuments(MATCHES_COLLECTION, [
        ['carrierId', '==', userId]
      ]);
    } 
    // For senders - get matches associated with their packages
    else if (userRole === 'sender') {
      // First get all packages for this sender
      const packages = await queryDocuments(PACKAGES_COLLECTION, [
        ['senderId', '==', userId]
      ]);
      
      const packageIds = packages.map(pkg => pkg.id);
      
      if (packageIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'No packages found for this sender'
        });
      }
      
      // For each packageId, get matches
      const matchPromises = packageIds.map(packageId => 
        queryDocuments(MATCHES_COLLECTION, [
          ['packageId', '==', packageId]
        ])
      );
      
      const matchResults = await Promise.all(matchPromises);
      matches = matchResults.flat();
    } 
    // Admins can see all but this endpoint is meant for personal matches
    else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this resource'
      });
    }
    
    res.status(200).json({
      success: true,
      data: matches
    });
  } catch (error) {
    logger.error('Error getting user matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user matches',
      error: (error as Error).message
    });
  }
};

/**
 * Get match by ID
 * @route GET /api/v1/matches/:id
 * @access Private
 */
export const getMatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated or role not defined' 
      });
    }
    
    const match = await getDocument(MATCHES_COLLECTION, id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Check authorization
    if (userRole !== 'admin') {
      if (userRole === 'carrier' && match.carrierId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to access this match'
        });
      }
      
      if (userRole === 'sender') {
        // Check if package belongs to sender
        const packageDoc = await getDocument(PACKAGES_COLLECTION, match.packageId);
        if (!packageDoc || packageDoc.senderId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to access this match'
          });
        }
      }
    }
    
    res.status(200).json({
      success: true,
      data: match
    });
  } catch (error) {
    logger.error('Error getting match:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving match',
      error: (error as Error).message
    });
  }
};

/**
 * Find carriers for a package using AI Matching
 * @route POST /api/v1/matches/find-carriers
 * @access Private (sender or admin)
 */
export const findCarriers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated or role not defined' 
      });
    }
    
    const { packageId, radius = 10, maxCarriers = 5 } = req.body;
    
    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: 'Package ID is required'
      });
    }
    
    // Get package details
    const packageData = await getDocument(PACKAGES_COLLECTION, packageId);
    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }
    
    // Authorization check for senders
    if (userRole === 'sender' && packageData.senderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to find carriers for this package'
      });
    }

    // Use AI Matching Service to find optimal carriers
    try {
      const matchedCarriers = await AIMatchingService.findOptimalCarriers(
        packageId, 
        Number(radius), 
        Number(maxCarriers)
      );

      // Transform to include more carrier details for the frontend
      const enrichedMatches = [];
      
      for (const match of matchedCarriers) {
        const carrierData = await getDocument(USERS_COLLECTION, match.carrierId);
        if (carrierData) {
          enrichedMatches.push({
            ...match,
            carrierName: carrierData.name,
            carrierRating: carrierData.rating,
            carrierVehicleType: carrierData.vehicleType,
            estimatedCarbonSavings: await CarbonEmissionService.estimateEmissionSavings(
              packageId, 
              match.carrierId,
              match.routeDeviation.distance
            )
          });
        }
      }
      
      res.status(200).json({
        success: true,
        data: enrichedMatches
      });
    } catch (error) {
      logger.error('Error in AI matching:', error);
      
      // Fallback to simpler matching if AI fails
      const carriers = await queryDocuments(USERS_COLLECTION, [
        ['role', '==', 'carrier'],
        ['active', '==', true]
      ], undefined, 50);
      
      // Simple matching algorithm - simulate scores
      const matchedCarriers = carriers
        .map(carrier => {
          const score = Math.floor(Math.random() * 51) + 50;
          const detourDistance = Math.random() * Number(radius);
          const detourTime = Math.floor(detourDistance * 3);
          
          return {
            carrierId: carrier.id,
            carrierName: carrier.name,
            score,
            compensation: 50 + (detourDistance * 10),
            routeDeviation: {
              distance: detourDistance,
              time: detourTime
            }
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(maxCarriers));
      
      res.status(200).json({
        success: true,
        data: matchedCarriers,
        note: "AI matching failed, falling back to simple matching algorithm"
      });
    }
  } catch (error) {
    logger.error('Error finding carriers:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding carriers',
      error: (error as Error).message
    });
  }
};

/**
 * Accept a match (carrier)
 * @route POST /api/v1/matches/:id/accept
 * @access Private (carrier)
 */
export const acceptMatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const carrierId = req.user?.id;
    const { notes } = req.body;
    
    if (!carrierId) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }
    
    // Get the match
    const match = await getDocument(MATCHES_COLLECTION, id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Verify carrier authorization
    if (match.carrierId !== carrierId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to accept this match'
      });
    }
    
    // Check if match is pending
    if (match.status !== MatchStatus.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Cannot accept match with status: ${match.status}`
      });
    }
    
    // Check if match is expired
    const isExpired = match.expiresAt.toDate() < new Date();
    if (isExpired) {
      await updateDocument(MATCHES_COLLECTION, id, {
        status: MatchStatus.EXPIRED
      });
      
      return res.status(400).json({
        success: false,
        message: 'Match has expired and cannot be accepted'
      });
    }
    
    // Update match to accepted
    await updateDocument(MATCHES_COLLECTION, id, {
      status: MatchStatus.ACCEPTED,
      responseTime: Timestamp.now(),
      carrierNotes: notes
    });
    
    // Get updated match
    const updatedMatch = await getDocument(MATCHES_COLLECTION, id);
    
    // Update the match success feedback for AI model
    await AIMatchingService.updateModelWithFeedback(id, true, 'Match accepted');
    
    res.status(200).json({
      success: true,
      data: updatedMatch,
      message: 'Match accepted successfully'
    });
  } catch (error) {
    logger.error('Error accepting match:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting match',
      error: (error as Error).message
    });
  }
};

/**
 * Reject a match (carrier)
 * @route POST /api/v1/matches/:id/reject
 * @access Private (carrier)
 */
export const rejectMatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const carrierId = req.user?.id;
    const { notes } = req.body;
    
    if (!carrierId) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }
    
    // Get the match
    const match = await getDocument(MATCHES_COLLECTION, id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Verify carrier authorization
    if (match.carrierId !== carrierId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to reject this match'
      });
    }
    
    // Check if match is pending
    if (match.status !== MatchStatus.PENDING) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject match with status: ${match.status}`
      });
    }
    
    // Update match to rejected
    await updateDocument(MATCHES_COLLECTION, id, {
      status: MatchStatus.REJECTED,
      responseTime: Timestamp.now(),
      carrierNotes: notes
    });
    
    // Get updated match
    const updatedMatch = await getDocument(MATCHES_COLLECTION, id);
    
    // Update the match failure feedback for AI model
    await AIMatchingService.updateModelWithFeedback(id, false, notes || 'Match rejected');
    
    res.status(200).json({
      success: true,
      data: updatedMatch,
      message: 'Match rejected successfully'
    });
  } catch (error) {
    logger.error('Error rejecting match:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting match',
      error: (error as Error).message
    });
  }
};

/**
 * Cancel a match
 * @route POST /api/v1/matches/:id/cancel
 * @access Private
 */
export const cancelMatch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { reason } = req.body;
    
    if (!userId || !userRole) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated or role not defined' 
      });
    }
    
    // Get the match
    const match = await getDocument(MATCHES_COLLECTION, id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Authorization check
    if (userRole !== 'admin') {
      // Carriers can only cancel their own accepted matches
      if (userRole === 'carrier') {
        if (match.carrierId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to cancel this match'
          });
        }
        
        if (match.status !== MatchStatus.ACCEPTED) {
          return res.status(400).json({
            success: false,
            message: 'Can only cancel accepted matches'
          });
        }
      }
      
      // Senders can cancel any matches for their packages
      if (userRole === 'sender') {
        const packageDoc = await getDocument(PACKAGES_COLLECTION, match.packageId);
        if (!packageDoc || packageDoc.senderId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to cancel this match'
          });
        }
      }
    }
    
    // Cannot cancel completed matches
    if (match.status === MatchStatus.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed match'
      });
    }
    
    // Update match to cancelled
    const notes = `Cancelled by ${userRole} (${userId}). Reason: ${reason || 'Not specified'}`;
    
    await updateDocument(MATCHES_COLLECTION, id, {
      status: MatchStatus.CANCELLED,
      adminNotes: match.adminNotes ? `${match.adminNotes}\n${notes}` : notes
    });
    
    // Get updated match
    const updatedMatch = await getDocument(MATCHES_COLLECTION, id);
    
    // Update AI model with cancellation feedback
    await AIMatchingService.updateModelWithFeedback(id, false, notes);
    
    res.status(200).json({
      success: true,
      data: updatedMatch,
      message: 'Match cancelled successfully'
    });
  } catch (error) {
    logger.error('Error cancelling match:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling match',
      error: (error as Error).message
    });
  }
};

/**
 * Get matches for a specific package
 * @route GET /api/v1/matches/package/:packageId
 * @access Private
 */
export const getPackageMatches = async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    if (!userId || !userRole) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated or role not defined' 
      });
    }
    
    // Verify package exists
    const packageDoc = await getDocument(PACKAGES_COLLECTION, packageId);
    if (!packageDoc) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }
    
    // Authorization check
    if (userRole !== 'admin') {
      // Senders can only see matches for their own packages
      if (userRole === 'sender' && packageDoc.senderId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view matches for this package'
        });
      }
      
      // Carriers can only see their own matches
      if (userRole === 'carrier') {
        // We'll filter matches later to show only their own
      }
    }
    
    // Get matches for the package
    let matches = await queryDocuments(MATCHES_COLLECTION, [
      ['packageId', '==', packageId]
    ]);
    
    // If carrier, filter to only show their matches
    if (userRole === 'carrier') {
      matches = matches.filter(match => match.carrierId === userId);
    }
    
    // For each match, get estimated carbon savings
    const matchesWithCarbon = await Promise.all(matches.map(async (match) => {
      const estimatedSavings = await CarbonEmissionService.estimateEmissionSavings(
        match.packageId,
        match.carrierId,
        match.detourDistance || 0
      );
      
      return {
        ...match,
        estimatedCarbonSavings: estimatedSavings
      };
    }));
    
    res.status(200).json({
      success: true,
      data: matchesWithCarbon
    });
  } catch (error) {
    logger.error('Error getting package matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving package matches',
      error: (error as Error).message
    });
  }
};

/**
 * Verify package delivery with code
 * @route POST /api/v1/matches/:id/verify-delivery
 * @access Private (carrier)
 */
export const verifyDelivery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const carrierId = req.user?.id;
    const { deliveryCode } = req.body;
    
    if (!carrierId) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }
    
    if (!deliveryCode) {
      return res.status(400).json({
        success: false,
        message: 'Delivery code is required'
      });
    }
    
    // Get the match
    const match = await getDocument(MATCHES_COLLECTION, id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Verify carrier authorization
    if (match.carrierId !== carrierId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to verify delivery for this match'
      });
    }
    
    // Check if package is in-transit
    const packageDoc = await getDocument(PACKAGES_COLLECTION, match.packageId);
    if (!packageDoc || packageDoc.status !== 'in_transit') {
      return res.status(400).json({
        success: false,
        message: 'Package must be in-transit to verify delivery'
      });
    }
    
    // Verify delivery code
    if (match.carrierDeliveryCode !== deliveryCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid delivery code'
      });
    }
    
    // Update package status to delivered
    const deliveryTime = Timestamp.now();
    await updateDocument(PACKAGES_COLLECTION, match.packageId, {
      status: 'delivered',
      deliveryTime
    });
    
    // Update match to completed
    await updateDocument(MATCHES_COLLECTION, id, {
      status: MatchStatus.COMPLETED,
      completedAt: deliveryTime,
      adminNotes: match.adminNotes 
        ? `${match.adminNotes}\nPackage delivered at ${new Date().toISOString()}`
        : `Package delivered at ${new Date().toISOString()}`
    });
    
    // Calculate carbon emissions for this delivery
    try {
      const emissionData = await CarbonEmissionService.processDeliveryEmissions(match.packageId);
      
      res.status(200).json({
        success: true,
        message: 'Package delivery verified and match completed successfully',
        data: {
          matchId: id,
          packageId: match.packageId,
          carbonEmissions: emissionData
        }
      });
    } catch (emissionError) {
      // Still return success for the delivery verification, but note the emission calculation error
      logger.error('Error calculating carbon emissions:', emissionError);
      
      res.status(200).json({
        success: true,
        message: 'Package delivery verified and match completed successfully',
        note: 'Carbon emission calculation failed',
        data: {
          matchId: id,
          packageId: match.packageId
        }
      });
    }
  } catch (error) {
    logger.error('Error verifying delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying delivery',
      error: (error as Error).message
    });
  }
};

/**
 * Automatically match packages with carriers (system/admin)
 * @route POST /api/v1/matches/auto-match
 * @access Private (admin)
 */
export const autoMatch = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.body;
    
    // Use AI Matching Service for auto-matching
    try {
      const results = await AIMatchingService.autoMatchPackages(parseInt(limit as string));
      
      if (results.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No packages found that need matching',
          data: []
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Auto-matched ${results.length} packages using AI matching`,
        data: results
      });
    } catch (aiError) {
      logger.error('AI auto-matching failed:', aiError);
      
      // Fallback to original matching logic
      // Find packages that need matching
      const packages = await queryDocuments(
        PACKAGES_COLLECTION,
        [
          ['status', '==', 'ready_for_pickup'],
          ['matched', '==', false]
        ],
        undefined,
        parseInt(limit as string)
      );
      
      if (packages.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No packages found that need matching',
          data: []
        });
      }
      
      // For each package, find suitable carriers
      const matchPromises = packages.map(async (pkg) => {
        // Find nearby carriers
        const carriers = await queryDocuments(
          USERS_COLLECTION,
          [
            ['role', '==', 'carrier'],
            ['active', '==', true]
          ],
          undefined,
          3 // Find top 3 carriers per package
        );
        
        if (carriers.length === 0) {
          return {
            packageId: pkg.id,
            matches: []
          };
        }
        
        // Create matches for each carrier
        const matchPromises = carriers.map(async (carrier) => {
          // Calculate score and other match attributes
          const score = Math.floor(Math.random() * 31) + 70; // 70-100
          const detourDistance = Math.random() * 5; // 0-5 km
          const detourTime = Math.floor(detourDistance * 3); // ~3 min per km
          
          // Set expiration time (4 hours from now)
          const expirationDate = new Date();
          expirationDate.setHours(expirationDate.getHours() + 4);
          
          // Calculate estimated times
          const now = new Date();
          const pickupTime = new Date(now.getTime() + 30 * 60000); // 30 mins from now
          const deliveryTime = new Date(pickupTime.getTime() + (pkg.estimatedDuration || 60) * 60000);
          
          // Set payout amount (simplified)
          const baseRate = 10; // $10 base
          const distanceRate = 0.5; // $0.50 per km
          const timeRate = 0.2; // $0.20 per minute
          
          const distance = pkg.distance || 5; // Default 5km if not specified
          const carrierPayoutAmount = baseRate + (distance * distanceRate) + (detourTime * timeRate);
          const platformFeeAmount = carrierPayoutAmount * 0.15; // 15% platform fee
          
          // Generate pickup and delivery codes
          const carrierPickupCode = Math.floor(100000 + Math.random() * 900000).toString();
          const carrierDeliveryCode = Math.floor(100000 + Math.random() * 900000).toString();
          
          // Create match
          const matchData:any = {
              packageId: pkg.id,
              carrierId: carrier.id,
              status: MatchStatus.PENDING,
              score,
              detourDistance,
              detourTime,
              estimatedPickupTime: Timestamp.fromDate(pickupTime),
              estimatedDeliveryTime: Timestamp.fromDate(deliveryTime),
              expiresAt: Timestamp.fromDate(expirationDate),
              carrierPayoutAmount,
              platformFeeAmount,
              carrierPickupCode,
              carrierDeliveryCode
            };
            
            const matchId = await createDocument(MATCHES_COLLECTION, matchData);
            return await getDocument(MATCHES_COLLECTION, matchId);
          });
          
          const matches = await Promise.all(matchPromises);
          
          // Mark package as matched
          await updateDocument(PACKAGES_COLLECTION, pkg.id, {
            matched: true,
            matchedAt: Timestamp.now()
          });
          
          return {
            packageId: pkg.id,
            matches
          };
        });
        
        const results = await Promise.all(matchPromises);
        
        res.status(200).json({
          success: true,
          message: `Auto-matched ${results.length} packages using fallback method`,
          note: "AI matching failed, using simpler algorithm",
          data: results
        });
      }
    } catch (error) {
      logger.error('Error auto-matching:', error);
      res.status(500).json({
        success: false,
        message: 'Error during auto-matching process',
        error: (error as Error).message
      });
    }
  };
  
  /**
   * Provide feedback on completed delivery (includes carbon impact)
   * @route POST /api/v1/matches/:id/feedback
   * @access Private (sender)
   */
  export const provideDeliveryFeedback = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const { rating, comment, environmentalImpactAwareness } = req.body;
      
      if (!userId || !userRole) {
        return res.status(401).json({ 
          success: false,
          message: 'User not authenticated or role not defined' 
        });
      }
      
      // Only senders can provide feedback
      if (userRole !== 'sender' && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only senders can provide delivery feedback'
        });
      }
      
      // Get the match
      const match = await getDocument(MATCHES_COLLECTION, id);
      
      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found'
        });
      }
      
      // Verify package ownership for senders
      if (userRole === 'sender') {
        const packageDoc = await getDocument(PACKAGES_COLLECTION, match.packageId);
        if (!packageDoc || packageDoc.senderId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to provide feedback for this delivery'
          });
        }
      }
      
      // Check if match is completed
      if (match.status !== MatchStatus.COMPLETED) {
        return res.status(400).json({
          success: false,
          message: 'Feedback can only be provided for completed deliveries'
        });
      }
      
      // Check if feedback already exists
      if (match.feedback) {
        return res.status(400).json({
          success: false,
          message: 'Feedback has already been provided for this delivery'
        });
      }
      
      // Validate rating
      const numericRating = parseFloat(rating);
      if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be a number between 1 and 5'
        });
      }
      
      // Get carbon emission data for the delivery
      let carbonData = null;
      try {
        carbonData = await CarbonEmissionService.getDeliveryEmissions(match.packageId);
      } catch (carbonError) {
        logger.warn('Could not retrieve carbon data for delivery feedback:', carbonError);
        // Continue without carbon data
      }
      
      // Save feedback
      const feedbackData = {
        rating: numericRating,
        comment: comment || '',
        environmentalImpactAwareness: environmentalImpactAwareness || 0,
        carbonData: carbonData,
        providedBy: userId,
        providedAt: Timestamp.now()
      };
      
      await updateDocument(MATCHES_COLLECTION, id, {
        feedback: feedbackData,
        updatedAt: Timestamp.now()
      });
      
      // If rating is good (4+), use as positive feedback for AI model
      if (numericRating >= 4) {
        await AIMatchingService.updateModelWithFeedback(
          id, 
          true, 
          `Positive delivery feedback: ${numericRating}/5`
        );
      }
      
      // Update carrier's average rating
      await updateCarrierRating(match.carrierId);
      
      // Get updated match
      const updatedMatch = await getDocument(MATCHES_COLLECTION, id);
      
      res.status(200).json({
        success: true,
        message: 'Feedback provided successfully',
        data: updatedMatch
      });
    } catch (error) {
      logger.error('Error providing delivery feedback:', error);
      res.status(500).json({
        success: false,
        message: 'Error providing delivery feedback',
        error: (error as Error).message
      });
    }
  };
  
  /**
   * Helper function to update a carrier's average rating
   */
  async function updateCarrierRating(carrierId: string): Promise<void> {
    try {
      // Get all completed matches for this carrier with feedback
      const matchesWithFeedback = await queryDocuments(MATCHES_COLLECTION, [
        ['carrierId', '==', carrierId],
        ['status', '==', MatchStatus.COMPLETED]
      ]);
      
      // Filter matches that have feedback
      const feedbacks = matchesWithFeedback
        .filter(match => match.feedback && match.feedback.rating)
        .map(match => match.feedback.rating);
      
      if (feedbacks.length === 0) {
        return; // No feedback yet
      }
      
      // Calculate average rating
      const totalRating = feedbacks.reduce((sum, rating) => sum + rating, 0);
      const averageRating = parseFloat((totalRating / feedbacks.length).toFixed(1));
      
      // Update carrier's rating
      await updateDocument(USERS_COLLECTION, carrierId, {
        rating: averageRating,
        totalRatings: feedbacks.length,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      logger.error(`Error updating carrier rating for ${carrierId}:`, error);
      // Don't throw error to avoid disrupting the main flow
    }
  }
  
  /**
   * Get carbon footprint for a specific match
   * @route GET /api/v1/matches/:id/carbon-impact
   * @access Private
   */
  export const getMatchCarbonFootprint = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId || !userRole) {
        return res.status(401).json({ 
          success: false,
          message: 'User not authenticated or role not defined' 
        });
      }
      
      // Get the match
      const match = await getDocument(MATCHES_COLLECTION, id);
      
      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found'
        });
      }
      
      // Check authorization
      if (userRole !== 'admin') {
        if (userRole === 'carrier' && match.carrierId !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Unauthorized to access this match'
          });
        }
        
        if (userRole === 'sender') {
          // Check if package belongs to sender
          const packageDoc = await getDocument(PACKAGES_COLLECTION, match.packageId);
          if (!packageDoc || packageDoc.senderId !== userId) {
            return res.status(403).json({
              success: false,
              message: 'Unauthorized to access this match'
            });
          }
        }
      }
      
      // Get carbon emissions data
      try {
        const carbonData = await CarbonEmissionService.getDeliveryEmissions(match.packageId);
        
        // Calculate environmental impact equivalents
        const treesPlantedEquivalent = carbonData!.emissionSavings / 20000; // Approx. CO2 absorbed by a tree per year (20kg)
        const carMilesEquivalent = carbonData!.emissionSavings / 250; // g CO2 per km for avg car, converted to miles
        
        res.status(200).json({
          success: true,
          data: {
            matchId: id,
            packageId: match.packageId,
            carrierId: match.carrierId,
            carbonEmissions: carbonData,
            environmentalEquivalents: {
              treesPlantedEquivalent: treesPlantedEquivalent.toFixed(2),
              carMilesEquivalent: carMilesEquivalent.toFixed(2)
            }
          }
        });
      } catch (error) {
        // Handle case where emissions haven't been calculated yet
        // This can happen if the match is not completed or if processDeliveryEmissions hasn't been called
        
        if (match.status !== MatchStatus.COMPLETED) {
          // For incomplete matches, provide an estimate based on route data
          const estimatedSavings = await CarbonEmissionService.estimateEmissionSavings(
            match.packageId,
            match.carrierId,
            match.detourDistance || 0
          );
          
          res.status(200).json({
            success: true,
            data: {
              matchId: id,
              packageId: match.packageId,
              carrierId: match.carrierId,
              estimatedCarbonSavings: estimatedSavings,
              note: 'Delivery not completed yet. These are estimated values.'
            }
          });
        } else {
          // For completed matches that don't have emission data (rare case)
          res.status(404).json({
            success: false,
            message: 'Carbon emission data not found for this delivery'
          });
        }
      }
    } catch (error) {
      logger.error('Error getting match carbon footprint:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving carbon footprint data',
        error: (error as Error).message
      });
    }
  };
  
  /**
   * Get carrier environmental impact statistics
   * @route GET /api/v1/matches/carrier/:carrierId/environmental-impact
   * @access Private
   */
  export const getCarrierEnvironmentalImpact = async (req: Request, res: Response) => {
    try {
      const { carrierId } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId || !userRole) {
        return res.status(401).json({ 
          success: false,
          message: 'User not authenticated or role not defined' 
        });
      }
      
      // Check authorization - carriers can only see their own stats
      if (userRole === 'carrier' && carrierId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to access this carrier\'s environmental impact'
        });
      }
      
      // Get carrier data to verify existence
      const carrierDoc = await getDocument(USERS_COLLECTION, carrierId);
      if (!carrierDoc) {
        return res.status(404).json({
          success: false,
          message: 'Carrier not found'
        });
      }
      
      // Retrieve carbon emission stats for this carrier
      try {
        const environmentalImpact = await CarbonEmissionService.getCarrierEmissionStats(carrierId);
        
        // Retrieve badges if available
        let badges = [];
        try {
          const badgesData = await CarbonEmissionService.generateCarrierEmissionBadges(carrierId);
          badges = badgesData?.earnedBadges || [];
        } catch (badgeError) {
          logger.warn('Error generating carrier badges:', badgeError);
          // Continue without badges
        }
        
        res.status(200).json({
          success: true,
          data: {
            carrierId,
            carrierName: carrierDoc.name,
            environmentalImpact,
            badges
          }
        });
      } catch (error) {
        logger.error('Error retrieving carrier environmental impact:', error);
        res.status(404).json({
          success: false,
          message: 'No environmental impact data found for this carrier'
        });
      }
    } catch (error) {
      logger.error('Error getting carrier environmental impact:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving carrier environmental impact data',
        error: (error as Error).message
      });
    }
  };