import { Request, Response, NextFunction } from 'express';
import { db, Timestamp } from '../config/database';
import Package, { PackageStatus, PackageSize } from '../models/Packages';
import { 
  NotificationType, 
  NotificationChannel, 
  NotificationPriority 
} from '../models/notificationModel';
import { 
  sendNotification, 
  addNotification 
} from '../models/notificationService';

import PackageTimeline from '../models/PackageTimeline';
import PackageIssue from '../models/Packages';
import User from '../models/User';
import { 
  NotFoundError, 
  BadRequestError, 
  InternalServerError,
  ForbiddenError,
  UnauthorizedError
} from '../utils/errorClasses';
import { logger } from '../utils/logger';
import { uploadToS3, generateSignedUrl } from '../utils/fileUpload';
import { sendEmail, sendSMS } from '../utils/notifications';
import { calculateDistance, validateCoordinates } from '../utils/geoUtils';
import { generateTrackingCode, generateDeliveryCode } from '../utils/generator';




/**
 * Create a new package
 */
export const createPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const senderId = req.user?.id;
    
    // Extract and validate package data
    const {
      title,
      description,
      size,
      weight,
      value,
      isFragile,
      requireSignature,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      pickupContactName,
      pickupContactPhone,
      pickupTimeWindow,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      deliveryContactName,
      deliveryContactPhone,
      deliveryTimeWindow,
      notes,
      isInsured
    } = req.body;
    
    // Validate required fields
    if (!title || !size || !weight || !pickupAddress || !deliveryAddress) {
      return next(new BadRequestError('Missing required package information'));
    }
    
    // Validate coordinates
    if (!validateCoordinates(pickupLatitude, pickupLongitude) || 
        !validateCoordinates(deliveryLatitude, deliveryLongitude)) {
      return next(new BadRequestError('Invalid coordinates provided'));
    }
    
    // Validate package size
    if (!Object.values(PackageSize).includes(size)) {
      return next(new BadRequestError(`Invalid package size. Valid sizes are: ${Object.values(PackageSize).join(', ')}`));
    }
    
    // Calculate distance between pickup and delivery
    const distance = calculateDistance(
      pickupLatitude, 
      pickupLongitude, 
      deliveryLatitude, 
      deliveryLongitude
    );
    
    // Calculate price based on distance, size, and weight
    // This is a simplified example - you would use a more complex pricing algorithm
    let basePrice = 5 + (distance * 0.5);
    
    // Add size multiplier
    const sizeMultiplier = {
      [PackageSize.SMALL]: 1,
      [PackageSize.MEDIUM]: 1.5,
      [PackageSize.LARGE]: 2,
      [PackageSize.EXTRA_LARGE]: 3
    };
    
    basePrice *= sizeMultiplier[size as PackageSize] ?? 1;
    
    // Add weight factor (e.g., $1 per kg)
    basePrice += weight * 1;
    
    // Round to 2 decimal places
    basePrice = Math.round(basePrice * 100) / 100;
    
    // Calculate commission (e.g., 15%)
    const commissionRate = 0.15;
    const commissionAmount = Math.round(basePrice * commissionRate * 100) / 100;
    
    // Calculate carrier payout
    const carrierPayoutAmount = Math.round((basePrice - commissionAmount) * 100) / 100;
    
    // Calculate insurance cost if requested
    let insuranceCost = 0;
    if (isInsured && value) {
      insuranceCost = Math.round(value * 0.05 * 100) / 100; // 5% of declared value
      basePrice += insuranceCost;
    }
    
    // Format time windows as JSON strings
    const formattedPickupTimeWindow = typeof pickupTimeWindow === 'string' 
      ? pickupTimeWindow 
      : JSON.stringify(pickupTimeWindow);
      
    const formattedDeliveryTimeWindow = typeof deliveryTimeWindow === 'string' 
      ? deliveryTimeWindow 
      : JSON.stringify(deliveryTimeWindow);
    
    // Generate tracking code
    const trackingCode = generateTrackingCode();
    
    // Generate delivery code if signature is required
    const deliveryCode = requireSignature ? generateDeliveryCode() : undefined;
    
    // Create the package
    const newPackage = await Package.create({
      senderId:senderId!,
      title,
      description,
      size,
      weight,
      value,
      isFragile: isFragile || false,
      requireSignature: requireSignature || false,
      status: PackageStatus.PENDING,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      pickupContactName,
      pickupContactPhone,
      pickupTimeWindow: formattedPickupTimeWindow,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      deliveryContactName,
      deliveryContactPhone,
      deliveryTimeWindow: formattedDeliveryTimeWindow,
      trackingCode,
      deliveryCode,
      price: basePrice,
      commissionAmount,
      carrierPayoutAmount,
      notes,
      isInsured: isInsured || false,
      insuranceCost: isInsured ? insuranceCost : undefined,
      distance
    });
    
    // Create initial timeline entry
    await PackageTimeline.create({
      packageId: newPackage.id,
      status: PackageStatus.PENDING,
      description: 'Package created and waiting for carrier match',
      userId: senderId!
    });

    if (!senderId) {
      logger.warn('Cannot create notification: User ID is undefined');
      return; // or handle appropriately
    }
    
    // Create notification for the sender using new Firestore service
    await sendNotification(
      senderId,
      NotificationType.PACKAGE_CREATED,
      {
        title: 'Package Created',
        message: `Your package ${newPackage.title} has been created with tracking code ${trackingCode}`,
        data: {
          packageId: newPackage.id,
          trackingCode
        },
        packageId: newPackage.id,
        priority: NotificationPriority.LOW
      }
    );

    // Send email notification to sender
    const user = await User.findById(senderId);
    if (user) {
      sendEmail(
        user.email,
        'Package Created Successfully',
        `Your package "${newPackage.title}" has been created successfully. Tracking code: ${trackingCode}`
      ).catch(err => logger.error('Failed to send email notification:', err));
    }
    
    res.status(201).json({
      success: true,
      data: newPackage
    });
  } catch (error) {
    logger.error('Error creating package:', error);
    next(new InternalServerError('Failed to create package'));
  }
};

/**
 * Get all packages (with filtering)
 */
export const getPackages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      status, 
      size, 
      minDistance, 
      maxDistance,
      minPrice,
      maxPrice,
      isFragile,
      requireSignature,
      isInsured,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;
    
    logger.info(`Fetching packages with filters: ${JSON.stringify(req.query)}`);
    logger.info(`User role: ${req.user?.role}, User ID: ${req.user?.id}`);
    
    // Build query filters
    const filters: any[] = [];
    
    // Filter by status
    if (status) {
      filters.push(['status', '==', status]);
    }
    
    // Filter by size
    if (size) {
      filters.push(['size', '==', size]);
    }
    
    // Filter by fragile
    if (isFragile !== undefined) {
      filters.push(['isFragile', '==', isFragile === 'true']);
    }
    
    // Filter by signature requirement
    if (requireSignature !== undefined) {
      filters.push(['requireSignature', '==', requireSignature === 'true']);
    }
    
    // Filter by insurance
    if (isInsured !== undefined) {
      filters.push(['isInsured', '==', isInsured === 'true']);
    }
    
    // Role-specific filtering
    if (req.user?.role === 'sender') {
      filters.push(['senderId', '==', req.user?.id]);
    }
    
    logger.info(`Applied filters: ${JSON.stringify(filters)}`);
    
    // Create query reference
    let query: FirebaseFirestore.Query = db.collection('packages');

    try {
      // Apply filters safely
      filters.forEach(filter => {
        query = query.where(filter[0], filter[1] as any, filter[2]);
      });
      
      // For carriers, we need a special combined query
      if (req.user?.role === 'carrier') {
        // Handle carrier specific logic...
        // (existing carrier logic unchanged)
      } else {
        // For other roles, continue with the regular query
        
        // Add date filters safely
        if (startDate) {
          try {
            const startDateObj = new Date(startDate as string);
            query = query.where('createdAt', '>=', Timestamp.fromDate(startDateObj));
          } catch (err) {
            logger.error(`Invalid start date format: ${startDate}`, err);
            // Continue without this filter if date is invalid
          }
        }
        
        if (endDate) {
          try {
            const endDateObj = new Date(endDate as string);
            query = query.where('createdAt', '<=', Timestamp.fromDate(endDateObj));
          } catch (err) {
            logger.error(`Invalid end date format: ${endDate}`, err);
            // Continue without this filter if date is invalid
          }
        }
        
        // Order by createdAt
        query = query.orderBy('createdAt', 'desc');
        
        // Execute the query
        logger.info('Executing query to fetch packages');
        const snapshot = await query.get();
        const totalCount = snapshot.size;
        logger.info(`Found ${totalCount} packages matching criteria`);
        
        // Get paginated data - use limit() and offset() safely
        const paginationLimit = Math.min(Number(limit) || 10, 100); // Cap at 100 max
        const paginationOffset = Math.max((Number(page) - 1) * paginationLimit, 0);
        
        const paginatedQuery = query
          .limit(paginationLimit)
          .offset(paginationOffset);
        
        const paginatedSnapshot = await paginatedQuery.get();
        
        // Convert to Package objects safely
        const packages = [];
        for (const doc of paginatedSnapshot.docs) {
          try {
            const data = doc.data();
            packages.push(Package.fromFirestore({ id: doc.id, ...data }));
          } catch (err) {
            logger.error(`Error processing package doc ${doc.id}:`, err);
            // Skip this document but continue with others
          }
        }
        
        // Filter by numeric fields safely
        let filteredPackages = packages;
        
        if (minDistance || maxDistance) {
          filteredPackages = filteredPackages.filter(pkg => {
            if (!pkg.distance) return false;
            if (minDistance && pkg.distance < Number(minDistance)) return false;
            if (maxDistance && pkg.distance > Number(maxDistance)) return false;
            return true;
          });
        }
        
        if (minPrice || maxPrice) {
          filteredPackages = filteredPackages.filter(pkg => {
            if (!pkg.price) return false;
            if (minPrice && pkg.price < Number(minPrice)) return false;
            if (maxPrice && pkg.price > Number(maxPrice)) return false;
            return true;
          });
        }
        
        // Return results
        res.status(200).json({
          success: true,
          count: totalCount,
          totalPages: Math.ceil(totalCount / paginationLimit),
          currentPage: Number(page),
          data: filteredPackages
        });
      }
    } catch (innerError) {
      logger.error('Error executing package query:', innerError);
      throw new Error(`Query execution error: ${(innerError as Error).message}`);
    }
  } catch (error) {
    logger.error('Error fetching packages:', error);
    next(new InternalServerError('Failed to fetch packages'));
  }
};

/**
 * Get current user's packages
 */
export const getUserPackages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build query filters
    const filters: any[] = [];
    
    // Filter by status if provided
    if (status) {
      filters.push(['status', '==', status]);
    }
    
    // Set user-specific condition based on role
    if (userRole === 'sender') {
      filters.push(['senderId', '==', userId]);
    } else if (userRole === 'carrier') {
      filters.push(['carrierId', '==', userId]);
    }
    
    // Create query reference
    
    // Apply filters
    let query: FirebaseFirestore.Query = db.collection('packages');

    // Apply filters with type safety
    filters.forEach(filter => {
      query = query.where(
        filter[0], 
        filter[1] as FirebaseFirestore.WhereFilterOp, 
        filter[2]
      );
    });
    
    // Use a type-safe approach for ordering
    query = query.orderBy('createdAt', 'desc' as FirebaseFirestore.OrderByDirection);
    
    // Execute the query to get count
    const countSnapshot = await query.count().get();
    const count = countSnapshot.data().count;
    
    // Get paginated data
    const paginatedQuery = query
      .limit(Number(limit))
      .offset((Number(page) - 1) * Number(limit));
    
    const paginatedSnapshot = await paginatedQuery.get();
    
    // Convert to Package objects
    const packages = paginatedSnapshot.docs.map(doc => {
      const data = doc.data();
      return Package.fromFirestore({ id: doc.id, ...data });
    });
    
    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
      data: packages
    });
  } catch (error) {
    logger.error('Error fetching user packages:', error);
    next(new InternalServerError('Failed to fetch user packages'));
  }
};

/**
 * Get package by ID
 */
export const getPackageById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params?.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user has access to this package
    if (userRole !== 'admin' && 
        packageItem.senderId !== userId && 
        packageItem.carrierId !== userId) {
      return next(new ForbiddenError('You do not have permission to access this package'));
    }
    
    res.status(200).json({
      success: true,
      data: packageItem
    });
  } catch (error) {
    logger.error(`Error fetching package ${req.params.id}:`, error);
    next(new InternalServerError('Failed to fetch package'));
  }
};

/**
 * Update package
 */
export const updatePackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user has permission to update this package
    if (userRole !== 'admin' && packageItem.senderId !== userId) {
      return next(new ForbiddenError('You do not have permission to update this package'));
    }
    
    // Check if package can be updated
    if (packageItem.status !== PackageStatus.PENDING) {
      return next(new BadRequestError('Package cannot be updated after it has been matched with a carrier'));
    }
    
    // Extract updatable fields
    const {
      title,
      description,
      size,
      weight,
      value,
      isFragile,
      requireSignature,
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      pickupContactName,
      pickupContactPhone,
      pickupTimeWindow,
      deliveryAddress,
      deliveryLatitude,
      deliveryLongitude,
      deliveryContactName,
      deliveryContactPhone,
      deliveryTimeWindow,
      notes,
      isInsured
    } = req.body;
    
    // Validate package size if provided
    if (size !== undefined && !Object.values(PackageSize).includes(size)) {
      return next(new BadRequestError(`Invalid package size. Valid sizes are: ${Object.values(PackageSize).join(', ')}`));
    }
    
    // Check coordinates if provided
    if ((pickupLatitude !== undefined && pickupLongitude !== undefined) && 
        !validateCoordinates(pickupLatitude, pickupLongitude)) {
      return next(new BadRequestError('Invalid pickup coordinates'));
    }
    
    if ((deliveryLatitude !== undefined && deliveryLongitude !== undefined) && 
        !validateCoordinates(deliveryLatitude, deliveryLongitude)) {
      return next(new BadRequestError('Invalid delivery coordinates'));
    }
    
    // Calculate new distance if coordinates changed
    let newDistance = packageItem.distance;
    if ((pickupLatitude !== undefined && pickupLongitude !== undefined) || 
        (deliveryLatitude !== undefined && deliveryLongitude !== undefined)) {
      const newPickupLat = pickupLatitude !== undefined ? pickupLatitude : packageItem.pickupLatitude;
      const newPickupLng = pickupLongitude !== undefined ? pickupLongitude : packageItem.pickupLongitude;
      const newDeliveryLat = deliveryLatitude !== undefined ? deliveryLatitude : packageItem.deliveryLatitude;
      const newDeliveryLng = deliveryLongitude !== undefined ? deliveryLongitude : packageItem.deliveryLongitude;
      
      newDistance = calculateDistance(
        newPickupLat, 
        newPickupLng, 
        newDeliveryLat, 
        newDeliveryLng
      );
    }
    
    // Update package fields
    if (title !== undefined) packageItem.title = title;
    if (description !== undefined) packageItem.description = description;
    if (size !== undefined) packageItem.size = size;
    if (weight !== undefined) packageItem.weight = weight;
    if (value !== undefined) packageItem.value = value;
    if (isFragile !== undefined) packageItem.isFragile = isFragile;
    if (requireSignature !== undefined) packageItem.requireSignature = requireSignature;
    if (pickupAddress !== undefined) packageItem.pickupAddress = pickupAddress;
    if (pickupLatitude !== undefined) packageItem.pickupLatitude = pickupLatitude;
    if (pickupLongitude !== undefined) packageItem.pickupLongitude = pickupLongitude;
    if (pickupContactName !== undefined) packageItem.pickupContactName = pickupContactName;
    if (pickupContactPhone !== undefined) packageItem.pickupContactPhone = pickupContactPhone;
    if (pickupTimeWindow !== undefined) {
      packageItem.pickupTimeWindow = typeof pickupTimeWindow === 'string' 
        ? pickupTimeWindow 
        : JSON.stringify(pickupTimeWindow);
    }
    if (deliveryAddress !== undefined) packageItem.deliveryAddress = deliveryAddress;
    if (deliveryLatitude !== undefined) packageItem.deliveryLatitude = deliveryLatitude;
    if (deliveryLongitude !== undefined) packageItem.deliveryLongitude = deliveryLongitude;
    if (deliveryContactName !== undefined) packageItem.deliveryContactName = deliveryContactName;
    if (deliveryContactPhone !== undefined) packageItem.deliveryContactPhone = deliveryContactPhone;
    if (deliveryTimeWindow !== undefined) {
      packageItem.deliveryTimeWindow = typeof deliveryTimeWindow === 'string' 
        ? deliveryTimeWindow 
        : JSON.stringify(deliveryTimeWindow);
    }
    if (notes !== undefined) packageItem.notes = notes;
    if (isInsured !== undefined) packageItem.isInsured = isInsured;
    
    // Update distance if calculated
    if (newDistance !== packageItem.distance) {
      packageItem.distance = newDistance;
      
      // Recalculate price
      let basePrice = 5 + (newDistance * 0.5);
      
      // Add size multiplier
      const sizeMultiplier = {
        [PackageSize.SMALL]: 1,
        [PackageSize.MEDIUM]: 1.5,
        [PackageSize.LARGE]: 2,
        [PackageSize.EXTRA_LARGE]: 3
      };
      
      basePrice *= sizeMultiplier[packageItem.size];
      
      // Add weight factor
      basePrice += packageItem.weight * 1;
      
      // Round to 2 decimal places
      basePrice = Math.round(basePrice * 100) / 100;
      
      // Calculate commission
      const commissionRate = 0.15;
      packageItem.commissionAmount = Math.round(basePrice * commissionRate * 100) / 100;
      
      // Calculate carrier payout
      packageItem.carrierPayoutAmount = Math.round((basePrice - packageItem.commissionAmount) * 100) / 100;
      
      // Calculate insurance cost if requested
      if (packageItem.isInsured && packageItem.value) {
        packageItem.insuranceCost = Math.round(packageItem.value * 0.05 * 100) / 100; // 5% of declared value
        basePrice += packageItem.insuranceCost;
      } else {
        packageItem.insuranceCost = 0;
      }
      
      packageItem.price = basePrice;
    }
    
    // Save updated package
    await packageItem.save();
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: packageItem.status,
      description: 'Package details updated',
      userId: userId!
    });
    
    // Create notification for the sender using new Firestore service
    await sendNotification(
      packageItem.senderId,
      NotificationType.PACKAGE_UPDATED,
      {
        title: 'Package Updated',
        message: `Your package ${packageItem.title} has been updated`,
        data: { packageId: packageItem.id },
        packageId: packageItem.id,
        priority: NotificationPriority.LOW
      }
    );
    
    res.status(200).json({
      success: true,
      data: packageItem
    });
  } catch (error) {
    logger.error(`Error updating package ${req.params.id}:`, error);
    next(new InternalServerError('Failed to update package'));
  }
};

/**
 * Cancel package
 */
export const cancelPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user has permission to cancel this package
    if (userRole !== 'admin' && packageItem.senderId !== userId) {
      return next(new ForbiddenError('You do not have permission to cancel this package'));
    }
    
    // Check if package can be cancelled
    if (packageItem.status === PackageStatus.DELIVERED || 
        packageItem.status === PackageStatus.CANCELLED) {
      return next(new BadRequestError(`Package is already ${packageItem.status}`));
    }
    
    // If package is already assigned to a carrier, we need to notify them
    const carrierId = packageItem.carrierId;
    
    // Update package status
    await packageItem.updateStatus(PackageStatus.CANCELLED);
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: PackageStatus.CANCELLED,
      description: 'Package cancelled by sender',
      userId: userId!
    });
    
    // Create notification for the sender using new Firestore service
    await sendNotification(
      packageItem.senderId,
      NotificationType.PACKAGE_CANCELLED,
      {
        title: 'Package Cancelled',
        message: `Your package ${packageItem.title} has been cancelled`,
        data: { packageId: packageItem.id },
        packageId: packageItem.id,
        priority: NotificationPriority.HIGH
      }
    );
    
    // If there was a carrier assigned, notify them as well
    if (carrierId) {
      await sendNotification(
        carrierId,
        NotificationType.PACKAGE_CANCELLED,
        {
          title: 'Package Cancelled',
          message: `Package ${packageItem.title} has been cancelled by the sender`,
          data: { packageId: packageItem.id },
          packageId: packageItem.id,
          priority: NotificationPriority.HIGH
        }
      );
      
      // You might want to send an SMS or push notification to the carrier
      // This is critical as they might be en route
    }
    
    res.status(200).json({
      success: true,
      message: 'Package cancelled successfully',
      data: packageItem
    });
  } catch (error) {
    logger.error(`Error cancelling package ${req.params.id}:`, error);
    next(new InternalServerError('Failed to cancel package'));
  }
};

/**
 * Track package (public route)
 */
export const trackPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { trackingCode } = req.query;
    
    if (!trackingCode) {
      return next(new BadRequestError('Tracking code is required'));
    }
    
    // Find the package by tracking code
    const packageItem = await Package.findByTrackingCode(trackingCode as string);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found or tracking code is invalid'));
    }
    
    // Get package timeline
    const timelineSnapshot = await db.collection('package_timeline')
      .where('packageId', '==', packageItem.id)
      .orderBy('createdAt', 'asc')
      .get();
    
    const timeline = timelineSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        status: data.status,
        description: data.description,
        timestamp: data.createdAt instanceof Timestamp ? 
          data.createdAt.toDate() : new Date(data.createdAt)
      };
    });
    
    // Prepare response with limited information
    const trackingInfo = {
      trackingCode: packageItem.trackingCode,
      status: packageItem.status,
      estimatedDeliveryTime: packageItem.estimatedDeliveryTime,
      packageSize: packageItem.size,
      packageWeight: packageItem.weight,
      pickupAddress: packageItem.pickupAddress,
      deliveryAddress: packageItem.deliveryAddress,
      timeline
    };
    
    res.status(200).json({
      success: true,
      data: trackingInfo
    });
  } catch (error) {
    logger.error(`Error tracking package:`, error);
    next(new InternalServerError('Failed to track package'));
  }
};

/**
 * Mark package as picked up (carrier only)
 */
export const pickupPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const carrierId = req.user?.id;
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if carrier is assigned to this package
    if (packageItem.carrierId !== carrierId) {
      return next(new ForbiddenError('You are not assigned to this package'));
    }
    
    // Check if package is in the correct state
    if (packageItem.status !== PackageStatus.PICKUP_READY && 
        packageItem.status !== PackageStatus.MATCHED) {
      return next(new BadRequestError(`Package is in ${packageItem.status} state and cannot be picked up`));
    }
    
    // Record pickup
    await packageItem.recordPickup();
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: PackageStatus.IN_TRANSIT,
      description: 'Package picked up by carrier',
      userId: carrierId!
    });
    
    // Create notification for the sender using new Firestore service
    await sendNotification(
      packageItem.senderId,
      NotificationType.PACKAGE_PICKED_UP,
      {
        title: 'Package Picked Up',
        message: `Your package ${packageItem.title} has been picked up by the carrier`,
        data: { packageId: packageItem.id },
        packageId: packageItem.id,
        priority: NotificationPriority.LOW
      }
    );
    
    // Send email notification to sender
    const sender = await User.findById(packageItem.senderId);
    if (sender) {
      sendEmail(
        sender.email,
        'Package Picked Up',
        `Your package "${packageItem.title}" has been picked up by the carrier. Tracking code: ${packageItem.trackingCode}`
      ).catch(err => logger.error('Failed to send email notification:', err));
    }
    
    res.status(200).json({
      success: true,
      message: 'Package marked as picked up',
      data: packageItem
    });
  } catch (error) {
    logger.error(`Error marking package ${req.params.id} as picked up:`, error);
    next(new InternalServerError('Failed to mark package as picked up'));
  }
};

/**
 * Report an issue with a package
 */
export const reportIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const userId = req.user?.id;
    const { issueType, description } = req.body;
    
    if (!issueType || !description) {
      return next(new BadRequestError('Issue type and description are required'));
    }
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user is involved with this package
    if (packageItem.senderId !== userId && packageItem.carrierId !== userId && req.user?.role !== 'admin') {
      return next(new ForbiddenError('You are not authorized to report issues for this package'));
    }
    
    // Add timeline entry with issue details
    const timelineEntry = await PackageTimeline.create({
      packageId: packageItem.id,
      status: packageItem.status,
      description: `Issue reported: ${issueType} - ${description}`,
      userId: userId!
    });
    
    // Notify the other party using new Firestore service
    const recipientId = packageItem.senderId === userId ? packageItem.carrierId : packageItem.senderId;
    
    if (recipientId) {
      await sendNotification(
        recipientId,
        NotificationType.ISSUE_REPORTED,
        {
          title: 'Package Issue Reported',
          message: `An issue has been reported for package ${packageItem.title}`,
          data: { packageId: packageItem.id, issueType, description },
          packageId: packageItem.id,
          priority: NotificationPriority.HIGH
        }
      );
    }
    
    // Notify admins using new Firestore service
    const adminUsersSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .get();
    
    const adminNotifications = [];
    for (const doc of adminUsersSnapshot.docs) {
      adminNotifications.push(
        sendNotification(
          doc.id,
          NotificationType.ISSUE_REPORTED,
          {
            title: 'Package Issue Reported',
            message: `An issue has been reported for package ${packageItem.title}`,
            data: { packageId: packageItem.id, issueType, description },
            packageId: packageItem.id,
            priority: NotificationPriority.HIGH
          }
        )
      );
    }
    
    await Promise.all(adminNotifications);
    
    res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      data: {
        packageId: packageItem.id,
        issueType,
        description,
        reportedBy: userId,
        reportedAt: new Date()
      }
    });
  } catch (error) {
    logger.error(`Error reporting issue for package ${req.params.id}:`, error);
    next(new InternalServerError('Failed to report issue'));
  }
};

/**
 * Get package status timeline
 */
export const getPackageTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const userId = req.user?.id;
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user is involved with this package
    if (packageItem.senderId !== userId && packageItem.carrierId !== userId && req.user?.role !== 'admin') {
      return next(new ForbiddenError('You are not authorized to view this package timeline'));
    }
    
    // Get package timeline from Firestore
    const timelineSnapshot = await db.collection('package_timeline')
      .where('packageId', '==', packageId)
      .orderBy('createdAt', 'asc')
      .get();
    
    // Convert timeline data
    const timeline = timelineSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        packageId: data.packageId,
        status: data.status,
        description: data.description,
        userId: data.userId,
        createdAt: data.createdAt instanceof Timestamp ? 
          data.createdAt.toDate() : new Date(data.createdAt)
      };
    });
    
    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    logger.error(`Error fetching package timeline ${req.params.id}:`, error);
    next(new InternalServerError('Failed to fetch package timeline'));
  }
};

/**
 * Upload package image
 */
export const uploadPackageImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const userId = req.user?.id;
    
    // Check if file was uploaded
    if (!req.file) {
      return next(new BadRequestError('No image file provided'));
    }
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user has permission to upload image
    if (packageItem.senderId !== userId && packageItem.carrierId !== userId && req.user?.role !== 'admin') {
      return next(new ForbiddenError('You do not have permission to upload images for this package'));
    }
    
    // Upload image to S3 (assuming you have this utility function)
    const imageUrl = await uploadToS3(req.file, `packages/${packageId}`);
    
    // Update package with image URL
    packageItem.imageUrl = imageUrl;
    await packageItem.save();
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: packageItem.status,
      description: 'Package image uploaded',
      userId: userId!
    });
    
    res.status(200).json({
      success: true,
      message: 'Package image uploaded successfully',
      data: {
        imageUrl
      }
    });
  } catch (error) {
    logger.error(`Error uploading package image ${req.params.id}:`, error);
    next(new InternalServerError('Failed to upload package image'));
  }
};

/**
 * Mark package as delivered (carrier only)
 */
export const deliverPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const carrierId = req.user?.id;
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if carrier is assigned to this package
    if (packageItem.carrierId !== carrierId) {
      return next(new ForbiddenError('You are not assigned to this package'));
    }
    
    // Check if package is in the correct state
    if (packageItem.status !== PackageStatus.IN_TRANSIT) {
      return next(new BadRequestError(`Package is in ${packageItem.status} state and cannot be delivered`));
    }
    
    // If delivery code is required, validate it
    if (packageItem.requireSignature) {
      const { deliveryCode } = req.body;
      
      if (!deliveryCode) {
        return next(new BadRequestError('Delivery code is required for this package'));
      }
      
      if (deliveryCode !== packageItem.deliveryCode) {
        return next(new BadRequestError('Invalid delivery code'));
      }
    }
    
    // Update package status
    packageItem.deliveryTime = new Date();
    await packageItem.recordDelivery();
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: PackageStatus.DELIVERED,
      description: 'Package delivered by carrier',
      userId: carrierId!
    });
    
    // Create notification for the sender using new Firestore service
    await sendNotification(
      packageItem.senderId,
      NotificationType.PACKAGE_DELIVERED,
      {
        title: 'Package Delivered',
        message: `Your package ${packageItem.title} has been delivered`,
        data: { packageId: packageItem.id },
        packageId: packageItem.id,
        priority: NotificationPriority.HIGH
      }
    );
    
    // Send email notification to sender
    const sender = await User.findById(packageItem.senderId);
    if (sender) {
      sendEmail(
        sender.email,
        'Package Delivered',
        `Your package "${packageItem.title}" has been delivered. Please confirm the delivery in the app.`
      ).catch(err => logger.error('Failed to send email notification:', err));
    }
    
    // Send SMS to delivery contact
    if (packageItem.deliveryContactPhone) {
      sendSMS(
        packageItem.deliveryContactPhone,
        `Your package has been delivered. Thank you for using CrowdShip!`
      ).catch(err => logger.error('Failed to send SMS notification:', err));
    }
    
    res.status(200).json({
      success: true,
      message: 'Package marked as delivered',
      data: packageItem
    });
  } catch (error) {
    logger.error(`Error marking package ${req.params.id} as delivered:`, error);
    next(new InternalServerError('Failed to mark package as delivered'));
  }
};

/**
 * Confirm package delivery (sender only)
 */
export const confirmDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const senderId = req.user?.id;
    
    // Find the package
    const packageItem = await Package.findById(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user is the sender of this package
    if (packageItem.senderId !== senderId) {
      return next(new ForbiddenError('You are not the sender of this package'));
    }
    
    // Check if package is in the delivered state
    if (packageItem.status !== PackageStatus.DELIVERED) {
      return next(new BadRequestError(`Package is in ${packageItem.status} state and cannot be confirmed`));
    }
    
    // No need to update the status, but we can add a timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: PackageStatus.DELIVERED,
      description: 'Delivery confirmed by sender',
      userId: senderId!
    });
    
    // Create notification for the carrier using new Firestore service
    await sendNotification(
      packageItem.carrierId!,
      NotificationType.PACKAGE_DELIVERED,
      {
        title: 'Delivery Confirmed',
        message: `The delivery of package ${packageItem.title} has been confirmed by the sender`,
        data: { packageId: packageItem.id },
        packageId: packageItem.id,
        priority: NotificationPriority.MEDIUM
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Package delivery confirmed',
      data: packageItem
    });
  } catch (error) {
    logger.error(`Error confirming package delivery ${req.params.id}:`, error);
    next(new InternalServerError('Failed to confirm package delivery'));
  }
};