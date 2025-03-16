import { Request, Response } from 'express';
import { db, Timestamp, queryDocuments, getDocument, createDocument, updateDocument } from '../config/database';
import { Match, MatchStatus } from '../models/Match';

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
    console.error('Error creating match:', error);
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
    
    // Execute query with pagination
    // Note: Firestore admin SDK doesn't support cursor pagination the same way
    // We'll use limit/offset style pagination instead
    const offset = (pageNumber - 1) * pageSize;
    
    // Execute query
    let allMatches = await queryDocuments(
      MATCHES_COLLECTION,
      queries,
      orderByOption
    );
    
    // Apply manual pagination (not efficient for large datasets but works for demo)
    const matches = allMatches.slice(offset, offset + pageSize);
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
    console.error('Error getting matches:', error);
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

    const useId = req.user?.id;
    const useRole = req.user?.role;
    if (!useId) {
    return res.status(401).json({ error: 'Unauthorized' });
   }
   if(!useRole){
    return res.status(401).json({ error: 'Unauthorized' });
   }
    const userId = useId;
    const userRole = useRole;
    
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
      // Note: Firebase Admin doesn't support 'in' queries the same way
      // We'll gather results for each package separately
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
    console.error('Error getting user matches:', error);
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
    const useId = req.user?.id;
    const useRole = req.user?.role;
    if (!useId) {
    return res.status(401).json({ error: 'Unauthorized' });
   }
   if(!useRole){
    return res.status(401).json({ error: 'Unauthorized' });
   }
    const userId = useId;
    const userRole = useRole;
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
    console.error('Error getting match:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving match',
      error: (error as Error).message
    });
  }
};

/**
 * Find carriers for a package
 * @route POST /api/v1/matches/find-carriers
 * @access Private (sender or admin)
 */
export const findCarriers = async (req: Request, res: Response) => {
  try {


    const useId = req.user?.id;
    const useRole = req.user?.role;
    if (!useId) {
    return res.status(401).json({ error: 'Unauthorized' });
   }
   if(!useRole){
    return res.status(401).json({ error: 'Unauthorized' });
   }
    const userId = useId;
    const userRole = useRole;
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
    
    // Find available carriers
    // This would typically involve:
    // 1. Geo-query to find carriers within radius of pickup location
    // 2. Filter by carrier availability, vehicle type, etc.
    // 3. Calculate matching scores
    
    // For this implementation, we'll simulate the carrier matching logic
    // In a real app, you might use a more sophisticated algorithm or service
    
    // Find carriers
    const carriers = await queryDocuments(USERS_COLLECTION, [
      ['role', '==', 'carrier'],
      ['active', '==', true]
    ], undefined, 50); // Get a pool of carriers to filter from
    
    // Simulate matching algorithm
    // In a real app, this would be more complex and consider:
    // - Geographic proximity
    // - Carrier ratings
    // - Package size/weight vs vehicle capacity
    // - Carrier schedule/availability
    // - Historical performance
    const matchedCarriers = carriers
      .map(carrier => {
        // Random score between 50-100 for simulation
        const score = Math.floor(Math.random() * 51) + 50;
        
        // Simulate detour calculation
        const detourDistance = Math.random() * radius;
        const detourTime = Math.floor(detourDistance * 3); // ~3 min per km
        
        return {
          carrierId: carrier.id,
          carrierName: carrier.name,
          score,
          detourDistance,
          detourTime
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCarriers);
    
    res.status(200).json({
      success: true,
      data: matchedCarriers
    });
  } catch (error) {
    console.error('Error finding carriers:', error);
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
    
    res.status(200).json({
      success: true,
      data: updatedMatch,
      message: 'Match accepted successfully'
    });
  } catch (error) {
    console.error('Error accepting match:', error);
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
    
    res.status(200).json({
      success: true,
      data: updatedMatch,
      message: 'Match rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting match:', error);
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
    
    res.status(200).json({
      success: true,
      data: updatedMatch,
      message: 'Match cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling match:', error);
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
    
    res.status(200).json({
      success: true,
      data: matches
    });
  } catch (error) {
    console.error('Error getting package matches:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving package matches',
      error: (error as Error).message
    });
  }
};

/**
 * Verify package pickup with code
 * @route POST /api/v1/matches/:id/verify-pickup
 * @access Private (carrier)
 */
// export const verifyPickup = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const carrierId = req.user?.id;
//     const { pickupCode } = req.body;
    
//     if (!pickupCode) {
//       return res.status(400).json({
//         success: false,
//         message: 'Pickup code is required'
//       });
//     }
    
// //  package status to in-transit
// //     // This would typically be a separate model/controller
// //     // But for this example, we'll assume a package status field exists
// //     await updateDoc(doc(packagesRef, match.packageId), {
// //       status: 'in_transit',
// //       pickupTime: Timestamp.now()
// //     });
    
// //     // We might also update the match but that depends on business logic
// //     // For this example, we'll add a note
// //     const notes = match.adminNotes 
// //       ? `${match.adminNotes}\nPackage picked up at ${new Date().toISOString()}`
// //       : `Package picked up at ${new Date().toISOString()}`;
      
// //     await updateMatchById(id, { adminNotes: notes });
    
//     res.status(200).json({
//       success: true,
//       message: 'Package pickup verified successfully'
//     });
//   } catch (error) {
//     console.error('Error verifying pickup:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error verifying pickup',
//       error: (error as Error).message
//     });
//   }
// };

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
    await updateDocument(PACKAGES_COLLECTION, match.packageId, {
      status: 'delivered',
      deliveryTime: Timestamp.now()
    });
    
    // Update match to completed
    await updateDocument(MATCHES_COLLECTION, id, {
      status: MatchStatus.COMPLETED,
      adminNotes: match.adminNotes 
        ? `${match.adminNotes}\nPackage delivered at ${new Date().toISOString()}`
        : `Package delivered at ${new Date().toISOString()}`
    });
    
    res.status(200).json({
      success: true,
      message: 'Package delivery verified and match completed successfully'
    });
  } catch (error) {
    console.error('Error verifying delivery:', error);
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
      // This is a simplified version - real implementation would use geoqueries
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
        // This is simplified - real implementation would use more factors
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
        const matchData = {
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
      message: `Auto-matched ${results.length} packages`,
      data: results
    });
  } catch (error) {
    console.error('Error auto-matching:', error);
    res.status(500).json({
      success: false,
      message: 'Error during auto-matching process',
      error: (error as Error).message
    });
  }
};