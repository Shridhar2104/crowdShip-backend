import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Match, Package, Route, User, CarrierProfile } from '../models';
import { MatchStatus } from '../models/Match';
import { PackageStatus } from '../models/Packages';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errorClasses';
import { logger } from '../utils/logger';

/**
 * Create a match manually (admin only)
 * @route POST /api/v1/matches
 * @access Private (admin)
 */
export const createMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      packageId,
      carrierId,
      routeId,
      score,
      detourDistance,
      detourTime,
      estimatedPickupTime,
      estimatedDeliveryTime,
      carrierPayoutAmount,
      platformFeeAmount,
      expiresAt,
    } = req.body;

    // Validate required fields
    if (!packageId || !carrierId) {
      throw new BadRequestError('Package ID and carrier ID are required');
    }

    // Check if package exists and is in a matchable state
    const packageItem = await Package.findByPk(packageId);
    if (!packageItem) {
      throw new NotFoundError('Package not found');
    }

    if (packageItem.status !== PackageStatus.PENDING) {
      throw new BadRequestError(`Package is not in a matchable state. Current status: ${packageItem.status}`);
    }

    // Check if carrier exists and is active
    const carrierUser = await User.findByPk(carrierId, {
      include: [{ model: CarrierProfile, as: 'carrierProfile' }]
    });

    if (!carrierUser || !carrierUser.carrierProfile) {
      throw new NotFoundError('Carrier not found');
    }

    if (!carrierUser.carrierProfile.isActive) {
      throw new BadRequestError('Carrier is not active');
    }

    // Check if route exists if routeId is provided
    if (routeId) {
      const route = await Route.findByPk(routeId);
      if (!route) {
        throw new NotFoundError('Route not found');
      }

      if (route.carrierId !== carrierId) {
        throw new BadRequestError('Route does not belong to the specified carrier');
      }
    }

    // Set default expiry if not provided (1 hour from now)
    const matchExpiresAt = expiresAt 
      ? new Date(expiresAt) 
      : new Date(Date.now() + 60 * 60 * 1000);
    
    // Calculate scores and distances if not provided
    const matchScore = score || 75; // Default score
    const matchDetourDistance = detourDistance || 0;
    const matchDetourTime = detourTime || 0;
    
    // Calculate carrier payout and platform fee if not provided
    // Typically these would come from a pricing service
    const matchCarrierPayoutAmount = carrierPayoutAmount || packageItem.carrierPayoutAmount;
    const matchPlatformFeeAmount = platformFeeAmount || packageItem.commissionAmount;

    // Create match
    const newMatch = await Match.create({
      packageId,
      carrierId,
      routeId,
      status: MatchStatus.PENDING,
      score: matchScore,
      detourDistance: matchDetourDistance,
      detourTime: matchDetourTime,
      estimatedPickupTime: estimatedPickupTime ? new Date(estimatedPickupTime) : new Date(),
      estimatedDeliveryTime: estimatedDeliveryTime ? new Date(estimatedDeliveryTime) : new Date(),
      expiresAt: matchExpiresAt,
      carrierPayoutAmount: matchCarrierPayoutAmount,
      platformFeeAmount: matchPlatformFeeAmount
    });

    logger.info(`Match created: ${newMatch.id} for package ${packageId} with carrier ${carrierId}`);

    // Update package status to MATCHED (if automatic)
    // Uncomment this if you want auto status change, otherwise it will change on carrier acceptance
    // await packageItem.update({ status: PackageStatus.MATCHED });

    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: newMatch,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all matches (filtered by query params)
 * @route GET /api/v1/matches
 * @access Private
 */
export const getMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    // Build query conditions
    const where: any = {};
    
    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Admin can see all matches, other users only see their own matches
    if (req.user?.role !== 'admin') {
      if (req.user?.role === 'carrier') {
        where.carrierId = req.user.id;
      } else {
        // For senders, find matches related to their packages
        const userPackages = await Package.findAll({
          where: { senderId: req.user?.id },
          attributes: ['id']
        });
        
        const packageIds = userPackages.map(pkg => pkg.id);
        where.packageId = {
          [Op.in]: packageIds
        };
      }
    }

    // Get matches with pagination
    const { count, rows: matches } = await Match.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Package,
          as: 'package',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'firstName', 'lastName', 'email']
            }
          ]
        },
        {
          model: User,
          as: 'carrier',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: Route,
          as: 'route',
        }
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        matches,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's matches
 * @route GET /api/v1/matches/me
 * @access Private
 */
export const getUserMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Ensure user is authenticated
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestError('User must be logged in');
    }

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;

    // Build query conditions
    const where: any = {};
    
    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Filter by user role
    if (req.user.role === 'carrier') {
      where.carrierId = userId;
    } else if (req.user.role === 'sender') {
      // For senders, find matches related to their packages
      const userPackages = await Package.findAll({
        where: { senderId: userId },
        attributes: ['id']
      });
      
      const packageIds = userPackages.map(pkg => pkg.id);
      if (packageIds.length === 0) {
        // No packages, so no matches
        res.status(200).json({
          success: true,
          data: {
            matches: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            perPage: limit,
          },
        });
        return;
      }
      
      where.packageId = {
        [Op.in]: packageIds
      };
    }

    // Get matches with pagination
    const { count, rows: matches } = await Match.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Package,
          as: 'package',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'firstName', 'lastName']
            }
          ]
        },
        {
          model: User,
          as: 'carrier',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Route,
          as: 'route'
        }
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        matches,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get match by ID
 * @route GET /api/v1/matches/:id
 * @access Private
 */
export const getMatchById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const match = await Match.findByPk(id, {
      include: [
        {
          model: Package,
          as: 'package',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'firstName', 'lastName', 'email']
            }
          ]
        },
        {
          model: User,
          as: 'carrier',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Route,
          as: 'route'
        }
      ],
    });

    if (!match) {
      throw new NotFoundError('Match not found');
    }

    // Check if user has permission to view this match
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== 'admin' && 
        match.carrierId !== userId && 
        match.package.senderId !== userId) {
      throw new ForbiddenError('You do not have permission to view this match');
    }

    res.status(200).json({
      success: true,
      data: match,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Find carriers for a package
 * @route POST /api/v1/matches/find-carriers
 * @access Private (sender or admin)
 */
export const findCarriers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { packageId } = req.body;

    if (!packageId) {
      throw new BadRequestError('Package ID is required');
    }

    // Check if package exists and is in a matchable state
    const packageItem = await Package.findByPk(packageId);
    if (!packageItem) {
      throw new NotFoundError('Package not found');
    }

    // Check if user has permission (must be sender or admin)
    if (req.user?.role !== 'admin' && packageItem.senderId !== req.user?.id) {
      throw new ForbiddenError('You do not have permission to find carriers for this package');
    }

    if (packageItem.status !== PackageStatus.PENDING) {
      throw new BadRequestError(`Package is not in a matchable state. Current status: ${packageItem.status}`);
    }

    // Get active carrier profiles
    const carrierProfiles = await CarrierProfile.findAll({
      where: {
        isActive: true,
        isVerified: true,
        maxWeight: {
          [Op.gte]: packageItem.weight
        }
      },
      include: [{
        model: User,
        as: 'user'
      }]
    });

    // Find active routes for these carriers
    const activeRoutes = await Route.findAll({
      where: {
        carrierId: {
          [Op.in]: carrierProfiles.map(profile => profile.userId)
        },
        isActive: true
      }
    });

    // For each route, calculate compatibility with package
    const compatibleRoutes = [];
    
    for (const route of activeRoutes) {
      // Simple compatibility check (in real app, use proper geospatial distance calculation)
      // Here using a helper function to calculate approximate detour
      const detourDistance = calculateApproximateDetour(
        route.startLatitude, route.startLongitude,
        route.endLatitude, route.endLongitude,
        packageItem.pickupLatitude, packageItem.pickupLongitude,
        packageItem.deliveryLatitude, packageItem.deliveryLongitude
      );
      
      // Check if detour is within carrier's max limit
      if (detourDistance <= route.maxDetourDistance) {
        // Calculate simple score (0-100)
        const score = calculateMatchScore(route, packageItem, detourDistance);
        
        // Calculate approximate detour time (assuming 30 km/h average speed)
        const detourTime = Math.round((detourDistance / 30) * 60); // minutes
        
        // Find carrier profile
        const carrierProfile = carrierProfiles.find(profile => profile.userId === route.carrierId);
        
        compatibleRoutes.push({
          route,
          carrier: carrierProfile?.user,
          carrierProfile,
          detourDistance,
          detourTime,
          score
        });
      }
    }

    // Sort by score (highest first)
    compatibleRoutes.sort((a, b) => b.score - a.score);

    res.status(200).json({
      success: true,
      data: {
        packageId: packageItem.id,
        potentialMatches: compatibleRoutes,
        matchCount: compatibleRoutes.length
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept a match (carrier)
 * @route POST /api/v1/matches/:id/accept
 * @access Private (carrier)
 */
export const acceptMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const match = await Match.findByPk(id, {
      include: [
        {
          model: Package,
          as: 'package'
        }
      ]
    });

    if (!match) {
      throw new NotFoundError('Match not found');
    }

    // Check if user is the carrier for this match
    const carrierId = req.user?.id;
    if (match.carrierId !== carrierId) {
      throw new ForbiddenError('You are not the carrier for this match');
    }

    // Check if match is in a acceptable state
    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestError(`Match cannot be accepted. Current status: ${match.status}`);
    }

    // Check if match is expired
    if (match.expiresAt < new Date()) {
      await match.update({ status: MatchStatus.EXPIRED });
      throw new BadRequestError('Match has expired');
    }

    // Start a transaction to update both match and package
    const transaction = await Match.sequelize?.transaction();
    
    try {
      // Update match status
      await match.update({
        status: MatchStatus.ACCEPTED,
        responseTime: new Date()
      }, { transaction });

      // Update package status and assign carrier
      await match.package.update({
        status: PackageStatus.PICKUP_READY,
        carrierId: carrierId,
        estimatedDeliveryTime: match.estimatedDeliveryTime
      }, { transaction });

      // Commit transaction
      await transaction?.commit();

      logger.info(`Match accepted: ${match.id} by carrier ${carrierId}`);

      res.status(200).json({
        success: true,
        message: 'Match accepted successfully',
        data: {
          matchId: match.id,
          packageId: match.packageId,
          status: match.status
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction?.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a match (carrier)
 * @route POST /api/v1/matches/:id/reject
 * @access Private (carrier)
 */
export const rejectMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const match = await Match.findByPk(id);
    if (!match) {
      throw new NotFoundError('Match not found');
    }

    // Check if user is the carrier for this match
    const carrierId = req.user?.id;
    if (match.carrierId !== carrierId) {
      throw new ForbiddenError('You are not the carrier for this match');
    }

    // Check if match is in a rejectable state
    if (match.status !== MatchStatus.PENDING) {
      throw new BadRequestError(`Match cannot be rejected. Current status: ${match.status}`);
    }

    // Update match status
    await match.update({
      status: MatchStatus.REJECTED,
      responseTime: new Date(),
      carrierNotes: reason || 'Rejected by carrier'
    });

    logger.info(`Match rejected: ${match.id} by carrier ${carrierId}`);

    res.status(200).json({
      success: true,
      message: 'Match rejected successfully',
      data: {
        matchId: match.id,
        status: match.status
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a match
 * @route POST /api/v1/matches/:id/cancel
 * @access Private
 */
export const cancelMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const match = await Match.findByPk(id, {
      include: [
        {
          model: Package,
          as: 'package'
        }
      ]
    });

    if (!match) {
      throw new NotFoundError('Match not found');
    }

    // Check if user has permission to cancel this match
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Package sender, assigned carrier, or admin can cancel
    if (userRole !== 'admin' && 
        match.carrierId !== userId && 
        match.package.senderId !== userId) {
      throw new ForbiddenError('You do not have permission to cancel this match');
    }

    // Check if match is in a cancellable state
    if (match.status !== MatchStatus.PENDING && 
        match.status !== MatchStatus.ACCEPTED) {
      throw new BadRequestError(`Match cannot be cancelled. Current status: ${match.status}`);
    }

    // Start a transaction to update both match and package if needed
    const transaction = await Match.sequelize?.transaction();
    
    try {
      // Update match status
      await match.update({
        status: MatchStatus.CANCELLED,
        carrierNotes: (match.carrierNotes ? match.carrierNotes + '\n' : '') + 
                      `Cancelled by ${userRole} (${userId}): ${reason || 'No reason provided'}`
      }, { transaction });

      // Update package status if this was an accepted match
      if (match.status === MatchStatus.ACCEPTED) {
        await match.package.update({
          status: PackageStatus.PENDING,
          carrierId: null,
          estimatedDeliveryTime: null
        }, { transaction });
      }

      // Commit transaction
      await transaction?.commit();

      logger.info(`Match cancelled: ${match.id} by user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Match cancelled successfully',
        data: {
          matchId: match.id,
          status: match.status
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction?.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get matches for a specific package
 * @route GET /api/v1/matches/package/:packageId
 * @access Private
 */
export const getPackageMatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { packageId } = req.params;
    const status = req.query.status as string;

    // Check if package exists
    const packageItem = await Package.findByPk(packageId);
    if (!packageItem) {
      throw new NotFoundError('Package not found');
    }

    // Check if user has permission to view this package's matches
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== 'admin' && 
        packageItem.senderId !== userId && 
        packageItem.carrierId !== userId) {
      throw new ForbiddenError('You do not have permission to view matches for this package');
    }

    // Build query
    const where: any = {
      packageId
    };

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Get matches
    const matches = await Match.findAll({
      where,
      order: [['score', 'DESC']],
      include: [
        {
          model: User,
          as: 'carrier',
          attributes: ['id', 'firstName', 'lastName', 'email'],
          include: [{
            model: CarrierProfile,
            as: 'carrierProfile',
            attributes: ['rating', 'totalRatings', 'totalDeliveries']
          }]
        },
        {
          model: Route,
          as: 'route'
        }
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        packageId,
        matches
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify package pickup with code
 * @route POST /api/v1/matches/:id/verify-pickup
 * @access Private (carrier)
 */
export const verifyPickup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { pickupCode } = req.body;

    if (!pickupCode) {
      throw new BadRequestError('Pickup code is required');
    }

    const match = await Match.findByPk(id, {
      include: [
        {
          model: Package,
          as: 'package'
        }
      ]
    });

    if (!match) {
      throw new NotFoundError('Match not found');
    }

    // Check if user is the carrier for this match
    const carrierId = req.user?.id;
    if (match.carrierId !== carrierId) {
      throw new ForbiddenError('You are not the carrier for this match');
    }

    // Check if match is in accepted state
    if (match.status !== MatchStatus.ACCEPTED) {
      throw new BadRequestError('Match is not in accepted state');
    }

    // Validate pickup code
    if (match.carrierPickupCode !== pickupCode) {
      throw new BadRequestError('Invalid pickup code');
    }

    // Start a transaction to update both match and package
    const transaction = await Match.sequelize?.transaction();
    
    try {
      // No need to update match status as it remains ACCEPTED

      // Update package status to in transit
      await match.package.update({
        status: PackageStatus.IN_TRANSIT,
        pickupTime: new Date()
      }, { transaction });

      // Commit transaction
      await transaction?.commit();

      logger.info(`Package pickup verified: Package ${match.packageId} by carrier ${carrierId}`);

      res.status(200).json({
        success: true,
        message: 'Package pickup verified successfully',
        data: {
          matchId: match.id,
          packageId: match.packageId,
          packageStatus: PackageStatus.IN_TRANSIT
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction?.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Verify package delivery with code
 * @route POST /api/v1/matches/:id/verify-delivery
 * @access Private (carrier)
 */
export const verifyDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { deliveryCode } = req.body;

    if (!deliveryCode) {
      throw new BadRequestError('Delivery code is required');
    }

    const match = await Match.findByPk(id, {
      include: [
        {
          model: Package,
          as: 'package'
        }
      ]
    });

    if (!match) {
      throw new NotFoundError('Match not found');
    }

    // Check if user is the carrier for this match
    const carrierId = req.user?.id;
    if (match.carrierId !== carrierId) {
      throw new ForbiddenError('You are not the carrier for this match');
    }

    // Check if package is in transit
    if (match.package.status !== PackageStatus.IN_TRANSIT) {
      throw new BadRequestError('Package is not in transit');
    }

    // Validate delivery code
    if (match.carrierDeliveryCode !== deliveryCode) {
      throw new BadRequestError('Invalid delivery code');
    }

    // Start a transaction to update both match and package
    const transaction = await Match.sequelize?.transaction();
    
    try {
      // Update match status
      await match.update({
        status: MatchStatus.COMPLETED
      }, { transaction });

      // Update package status to delivered
      await match.package.update({
        status: PackageStatus.DELIVERED,
        deliveryTime: new Date()
      }, { transaction });

      // Update carrier profile stats (increment total deliveries)
      const carrierProfile = await CarrierProfile.findOne({
        where: { userId: carrierId }
      });

      if (carrierProfile) {
        await carrierProfile.update({
          totalDeliveries: carrierProfile.totalDeliveries + 1
        }, { transaction });
      }

      // Commit transaction
      await transaction?.commit();

      logger.info(`Package delivery verified: Package ${match.packageId} by carrier ${carrierId}`);

      res.status(200).json({
        success: true,
        message: 'Package delivery verified successfully',
        data: {
          matchId: match.id,
          packageId: match.packageId,
          matchStatus: MatchStatus.COMPLETED,
          packageStatus: PackageStatus.DELIVERED
        }
      });
    } catch (error) {
      // Rollback transaction on error
      await transaction?.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Automatically match packages with carriers (system/admin)
 * @route POST /api/v1/matches/auto-match
 * @access Private (admin)
 */
export const autoMatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get unmatched packages
    const unmatchedPackages = await Package.findAll({
      where: {
        status: PackageStatus.PENDING
      }
    });

    if (unmatchedPackages.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No packages available for matching',
        data: { matchesCreated: 0 }
      });
      return;
    }

    // Get active carrier profiles
    const carrierProfiles = await CarrierProfile.findAll({
      where: {
        isActive: true,
        isVerified: true,
        isOnline: true
      },
      include: [{
        model: User,
        as: 'user'
      }]
    });

    if (carrierProfiles.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No active carriers available for matching',
        data: { matchesCreated: 0 }
      });
      return;
    }

    // Get all active routes
    const activeRoutes = await Route.findAll({
      where: {
        carrierId: {
          [Op.in]: carrierProfiles.map(profile => profile.userId)
        },
        isActive: true
      }
    });

    // Track created matches
    const createdMatches = [];

    // For each package, find compatible routes
    for (const packageItem of unmatchedPackages) {
      const compatibleRoutes = [];
      
      for (const route of activeRoutes) {
        // Check weight compatibility
        const carrierProfile = carrierProfiles.find(profile => profile.userId === route.carrierId);
        if (!carrierProfile || packageItem.weight > carrierProfile.maxWeight) {
          continue;
        }
        
        // Calculate detour distance (simplified)
        const detourDistance = calculateApproximateDetour(
          route.startLatitude, route.startLongitude,
          route.endLatitude, route.endLongitude,
          packageItem.pickupLatitude, packageItem.pickupLongitude,
          packageItem.deliveryLatitude, packageItem.deliveryLongitude
        );
        
        // Check if detour is within carrier's max limit
        if (detourDistance <= route.maxDetourDistance) {
          // Calculate match score
          const score = calculateMatchScore(route, packageItem, detourDistance);
          
          // Calculate detour time (simplified)
          const detourTime = Math.round((detourDistance / 30) * 60); // minutes
          
          compatibleRoutes.push({
            route,
            carrierId: route.carrierId,
            detourDistance,
            detourTime,
            score
          });
        }
      }
      
      // Sort by score (highest first)
      compatibleRoutes.sort((a, b) => b.score - a.score);
      
      // Create match for best route if any
      if (compatibleRoutes.length > 0) {
        const bestMatch = compatibleRoutes[0];
        
        // Set expiry (1 hour from now)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        
        // Estimated pickup and delivery times (simplified)
        const estimatedPickupTime = new Date(bestMatch.route.startTime);
        
        // Approximate delivery time based on duration
        const estimatedDeliveryTime = new Date(estimatedPickupTime);
        estimatedDeliveryTime.setMinutes(
          estimatedDeliveryTime.getMinutes() + 
          bestMatch.route.estimatedDuration + 
          bestMatch.detourTime
        );
        
        // Create match
        const newMatch = await Match.create({
          packageId: packageItem.id,
          carrierId: bestMatch.carrierId,
          routeId: bestMatch.route.id,
          status: MatchStatus.PENDING,
          score: bestMatch.score,
          detourDistance: bestMatch.detourDistance,
          detourTime: bestMatch.detourTime,
          estimatedPickupTime,
          estimatedDeliveryTime,
          expiresAt,
          carrierPayoutAmount: packageItem.carrierPayoutAmount,
          platformFeeAmount: packageItem.commissionAmount
        });
        
        createdMatches.push(newMatch);
      }
    }

    logger.info(`Auto-match created ${createdMatches.length} matches`);

    res.status(200).json({
      success: true,
      message: `Created ${createdMatches.length} matches`,
      data: {
        matchesCreated: createdMatches.length,
        matches: createdMatches
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to calculate approximate detour distance
 */
function calculateApproximateDetour(
  routeStartLat: number, routeStartLng: number,
  routeEndLat: number, routeEndLng: number,
  pickupLat: number, pickupLng: number,
  deliveryLat: number, deliveryLng: number
): number {
  // Calculate direct distance between route start and end
  const directDistance = calculateDistance(
    routeStartLat, routeStartLng,
    routeEndLat, routeEndLng
  );
  
  // Calculate distance with detour
  const toPickupDistance = calculateDistance(
    routeStartLat, routeStartLng,
    pickupLat, pickupLng
  );
  
  const pickupToDeliveryDistance = calculateDistance(
    pickupLat, pickupLng,
    deliveryLat, deliveryLng
  );
  
  const deliveryToEndDistance = calculateDistance(
    deliveryLat, deliveryLng,
    routeEndLat, routeEndLng
  );
  
  const totalDetourDistance = toPickupDistance + pickupToDeliveryDistance + deliveryToEndDistance;
  
  // Calculate detour as the difference
  return Math.max(0, totalDetourDistance - directDistance);
}

/**
 * Helper function to calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

/**
 * Helper function to convert degrees to radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

/**
 * Helper function to calculate match score
 */
function calculateMatchScore(route: any, packageItem: any, detourDistance: number): number {
  // Base score - maximum 100
  let score = 100;
  
  // Deduct points based on detour distance percentage
  // (higher detour = lower score)
  const detourPercentage = (detourDistance / route.distance) * 100;
  score -= Math.min(50, detourPercentage); // Max 50 point deduction
  
  // Deduct points if package weight is close to carrier's capacity
  // (closer to max capacity = lower score)
  const capacityPercentage = (packageItem.weight / route.availableCapacity) * 100;
  score -= Math.min(20, capacityPercentage / 5); // Max 20 point deduction
  
  // Check time compatibility (would be more sophisticated in real app)
  // For now, just a small bonus/penalty
  const timeCompatibility = 5; // -5 to +5 points
  score += timeCompatibility;
  
  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}