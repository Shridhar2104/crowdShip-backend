import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import Package, { PackageStatus, PackageSize } from '../models/Package';
import Notification, { NotificationType, NotificationChannel } from '../models/Notification';
import PackageTimeline from '../models/PackageTimeline';
import { 
  NotFoundError, 
  BadRequestError, 
  InternalServerError,
  ForbiddenError,
  UnauthorizedError
} from '../utils/errorClasses';
import {logger} from '../utils/logger';
import { uploadToS3, generateSignedUrl } from '../utils/fileUpload';
import { sendEmail, sendSMS } from '../utils/notifications';
import { calculateDistance, validateCoordinates } from '../utils/geoUtils';
import { generateTrackingCode, generateDeliveryCode } from '../utils/generators';

/**
 * Create a new package
 */
export const createPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const senderId = req.user.id;
    
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
    
    basePrice *= sizeMultiplier[size];
    
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
      senderId,
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
      userId: senderId
    });
    
    // Create notification for the sender
    await Notification.create({
      userId: senderId,
      type: NotificationType.PACKAGE_CREATED,
      title: 'Package Created',
      message: `Your package ${newPackage.title} has been created with tracking code ${trackingCode}`,
      data: JSON.stringify({ packageId: newPackage.id, trackingCode }),
      isRead: false,
      isArchived: false,
      channel: NotificationChannel.IN_APP,
      packageId: newPackage.id,
      sentAt: new Date()
    });
    
    // Send email notification to sender
    sendEmail(
      req.user.email,
      'Package Created Successfully',
      `Your package "${newPackage.title}" has been created successfully. Tracking code: ${trackingCode}`
    ).catch(err => logger.error('Failed to send email notification:', err));
    
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
    
    // Build query conditions
    const conditions: any = {};
    
    // Filter by status
    if (status) {
      conditions.status = status;
    }
    
    // Filter by size
    if (size) {
      conditions.size = size;
    }
    
    // Filter by distance
    if (minDistance) {
      conditions.distance = { ...conditions.distance, [Op.gte]: Number(minDistance) };
    }
    
    if (maxDistance) {
      conditions.distance = { ...conditions.distance, [Op.lte]: Number(maxDistance) };
    }
    
    // Filter by price
    if (minPrice) {
      conditions.price = { ...conditions.price, [Op.gte]: Number(minPrice) };
    }
    
    if (maxPrice) {
      conditions.price = { ...conditions.price, [Op.lte]: Number(maxPrice) };
    }
    
    // Filter by fragile
    if (isFragile !== undefined) {
      conditions.isFragile = isFragile === 'true';
    }
    
    // Filter by signature requirement
    if (requireSignature !== undefined) {
      conditions.requireSignature = requireSignature === 'true';
    }
    
    // Filter by insurance
    if (isInsured !== undefined) {
      conditions.isInsured = isInsured === 'true';
    }
    
    // Filter by date range
    if (startDate) {
      conditions.createdAt = { ...conditions.createdAt, [Op.gte]: new Date(startDate as string) };
    }
    
    if (endDate) {
      conditions.createdAt = { ...conditions.createdAt, [Op.lte]: new Date(endDate as string) };
    }
    
    // Role-specific filtering
    if (req.user.role === 'sender') {
      conditions.senderId = req.user.id;
    } else if (req.user.role === 'carrier') {
      // For carriers, show either their assigned packages or available packages
      conditions[Op.or] = [
        { carrierId: req.user.id },
        { 
          status: PackageStatus.PENDING,
          carrierId: null
        }
      ];
    }
    // Admin can see all packages
    
    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    // Execute the query
    const { count, rows: packages } = await Package.findAndCountAll({
      where: conditions,
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
      data: packages
    });
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
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build query conditions
    const conditions: any = {};
    
    // Filter by status if provided
    if (status) {
      conditions.status = status;
    }
    
    // Set user-specific condition based on role
    if (userRole === 'sender') {
      conditions.senderId = userId;
    } else if (userRole === 'carrier') {
      conditions.carrierId = userId;
    }
    
    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    // Execute the query
    const { count, rows: packages } = await Package.findAndCountAll({
      where: conditions,
      limit: Number(limit),
      offset,
      order: [['createdAt', 'DESC']]
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
    const packageId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
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
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
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
    
    // Create an update object with only the fields that were provided
    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (size !== undefined) {
      // Validate package size
      if (!Object.values(PackageSize).includes(size)) {
        return next(new BadRequestError(`Invalid package size. Valid sizes are: ${Object.values(PackageSize).join(', ')}`));
      }
      updateData.size = size;
    }
    if (weight !== undefined) updateData.weight = weight;
    if (value !== undefined) updateData.value = value;
    if (isFragile !== undefined) updateData.isFragile = isFragile;
    if (requireSignature !== undefined) updateData.requireSignature = requireSignature;
    
    // Address updates
    if (pickupAddress !== undefined) updateData.pickupAddress = pickupAddress;
    if (pickupLatitude !== undefined && pickupLongitude !== undefined) {
      if (!validateCoordinates(pickupLatitude, pickupLongitude)) {
        return next(new BadRequestError('Invalid pickup coordinates'));
      }
      updateData.pickupLatitude = pickupLatitude;
      updateData.pickupLongitude = pickupLongitude;
    }
    if (pickupContactName !== undefined) updateData.pickupContactName = pickupContactName;
    if (pickupContactPhone !== undefined) updateData.pickupContactPhone = pickupContactPhone;
    if (pickupTimeWindow !== undefined) {
      updateData.pickupTimeWindow = typeof pickupTimeWindow === 'string' 
        ? pickupTimeWindow 
        : JSON.stringify(pickupTimeWindow);
    }
    
    if (deliveryAddress !== undefined) updateData.deliveryAddress = deliveryAddress;
    if (deliveryLatitude !== undefined && deliveryLongitude !== undefined) {
      if (!validateCoordinates(deliveryLatitude, deliveryLongitude)) {
        return next(new BadRequestError('Invalid delivery coordinates'));
      }
      updateData.deliveryLatitude = deliveryLatitude;
      updateData.deliveryLongitude = deliveryLongitude;
    }
    if (deliveryContactName !== undefined) updateData.deliveryContactName = deliveryContactName;
    if (deliveryContactPhone !== undefined) updateData.deliveryContactPhone = deliveryContactPhone;
    if (deliveryTimeWindow !== undefined) {
      updateData.deliveryTimeWindow = typeof deliveryTimeWindow === 'string' 
        ? deliveryTimeWindow 
        : JSON.stringify(deliveryTimeWindow);
    }
    
    if (notes !== undefined) updateData.notes = notes;
    if (isInsured !== undefined) updateData.isInsured = isInsured;
    
    // If both pickup and delivery coordinates were updated, recalculate distance
    if ((pickupLatitude !== undefined && pickupLongitude !== undefined) || 
        (deliveryLatitude !== undefined && deliveryLongitude !== undefined)) {
      const newPickupLat = pickupLatitude !== undefined ? pickupLatitude : packageItem.pickupLatitude;
      const newPickupLng = pickupLongitude !== undefined ? pickupLongitude : packageItem.pickupLongitude;
      const newDeliveryLat = deliveryLatitude !== undefined ? deliveryLatitude : packageItem.deliveryLatitude;
      const newDeliveryLng = deliveryLongitude !== undefined ? deliveryLongitude : packageItem.deliveryLongitude;
      
      updateData.distance = calculateDistance(
        newPickupLat, 
        newPickupLng, 
        newDeliveryLat, 
        newDeliveryLng
      );
      
      // Recalculate price based on new distance and other factors
      if (updateData.distance !== packageItem.distance || 
          updateData.size !== undefined || 
          updateData.weight !== undefined || 
          updateData.isInsured !== undefined || 
          updateData.value !== undefined) {
        
        // Get current or updated values
        const updatedSize = updateData.size || packageItem.size;
        const updatedWeight = updateData.weight || packageItem.weight;
        const updatedIsInsured = updateData.isInsured !== undefined ? updateData.isInsured : packageItem.isInsured;
        const updatedValue = updateData.value || packageItem.value;
        
        // Calculate new price
        let basePrice = 5 + (updateData.distance * 0.5);
        
        // Add size multiplier
        const sizeMultiplier = {
          [PackageSize.SMALL]: 1,
          [PackageSize.MEDIUM]: 1.5,
          [PackageSize.LARGE]: 2,
          [PackageSize.EXTRA_LARGE]: 3
        };
        
        basePrice *= sizeMultiplier[updatedSize];
        
        // Add weight factor
        basePrice += updatedWeight * 1;
        
        // Round to 2 decimal places
        basePrice = Math.round(basePrice * 100) / 100;
        
        // Calculate commission
        const commissionRate = 0.15;
        updateData.commissionAmount = Math.round(basePrice * commissionRate * 100) / 100;
        
        // Calculate carrier payout
        updateData.carrierPayoutAmount = Math.round((basePrice - updateData.commissionAmount) * 100) / 100;
        
        // Calculate insurance cost if requested
        if (updatedIsInsured && updatedValue) {
          updateData.insuranceCost = Math.round(updatedValue * 0.05 * 100) / 100; // 5% of declared value
          basePrice += updateData.insuranceCost;
        } else {
          updateData.insuranceCost = 0;
        }
        
        updateData.price = basePrice;
      }
    }
    
    // Update the package
    await packageItem.update(updateData);
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: packageItem.status,
      description: 'Package details updated',
      userId: userId
    });
    
    // Create notification for the sender
    await Notification.create({
      userId: packageItem.senderId,
      type: NotificationType.PACKAGE_UPDATED,
      title: 'Package Updated',
      message: `Your package ${packageItem.title} has been updated`,
      data: JSON.stringify({ packageId: packageItem.id }),
      isRead: false,
      isArchived: false,
      channel: NotificationChannel.IN_APP,
      packageId: packageItem.id,
      sentAt: new Date()
    });
    
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
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
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
    await packageItem.update({
      status: PackageStatus.CANCELLED
    });
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: PackageStatus.CANCELLED,
      description: 'Package cancelled by sender',
      userId: userId
    });
    
    // Create notification for the sender
    await Notification.create({
      userId: packageItem.senderId,
      type: NotificationType.PACKAGE_CANCELLED,
      title: 'Package Cancelled',
      message: `Your package ${packageItem.title} has been cancelled`,
      data: JSON.stringify({ packageId: packageItem.id }),
      isRead: false,
      isArchived: false,
      channel: NotificationChannel.IN_APP,
      packageId: packageItem.id,
      sentAt: new Date()
    });
    
    // If there was a carrier assigned, notify them as well
    if (carrierId) {
      await Notification.create({
        userId: carrierId,
        type: NotificationType.PACKAGE_CANCELLED,
        title: 'Package Cancelled',
        message: `Package ${packageItem.title} has been cancelled by the sender`,
        data: JSON.stringify({ packageId: packageItem.id }),
        isRead: false,
        isArchived: false,
        channel: NotificationChannel.IN_APP,
        packageId: packageItem.id,
        sentAt: new Date()
      });
      
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
    const packageId = req.params.id;
    const { trackingCode } = req.query;
    
    if (!trackingCode) {
      return next(new BadRequestError('Tracking code is required'));
    }
    
    // Find the package by ID and tracking code
    const packageItem = await Package.findOne({
      where: {
        id: packageId,
        trackingCode: trackingCode as string
      }
    });
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found or tracking code is invalid'));
    }
    
    // Get package timeline
    const timeline = await PackageTimeline.findAll({
      where: { packageId: packageItem.id },
      order: [['createdAt', 'ASC']]
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
      timeline: timeline.map(entry => ({
        status: entry.status,
        description: entry.description,
        timestamp: entry.createdAt
      }))
    };
    
    res.status(200).json({
      success: true,
      data: trackingInfo
    });
  } catch (error) {
    logger.error(`Error tracking package ${req.params.id}:`, error);
    next(new InternalServerError('Failed to track package'));
  }
};

/**
 * Mark package as picked up (carrier only)
 */
export const pickupPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const carrierId = req.user.id;
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
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
    
    // Update package status
    await packageItem.update({
      status: PackageStatus.IN_TRANSIT,
      pickupTime: new Date()
    });
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: PackageStatus.IN_TRANSIT,
      description: 'Package picked up by carrier',
      userId: carrierId
    });
    
    // Create notification for the sender
    await Notification.create({
      userId: packageItem.senderId,
      type: NotificationType.PACKAGE_PICKED_UP,
      title: 'Package Picked Up',
      message: `Your package ${packageItem.title} has been picked up by the carrier`,
      data: JSON.stringify({ packageId: packageItem.id }),
      isRead: false,
      isArchived: false,
      channel: NotificationChannel.IN_APP,
      packageId: packageItem.id,
      sentAt: new Date()
    });
    
    // Send email notification to sender
    sendEmail(
      req.user.email,
      'Package Picked Up',
      `Your package "${packageItem.title}" has been picked up by the carrier. Tracking code: ${packageItem.trackingCode}`
    ).catch(err => logger.error('Failed to send email notification:', err));
    
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
 * Confirm package delivery (sender only)
 */
export const confirmDelivery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const senderId = req.user.id;
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
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
      userId: senderId
    });
    
    // Create notification for the carrier
    await Notification.create({
      userId: packageItem.carrierId,
      type: NotificationType.DELIVERY_CONFIRMED,
      title: 'Delivery Confirmed',
      message: `The delivery of package ${packageItem.title} has been confirmed by the sender`,
      data: JSON.stringify({ packageId: packageItem.id }),
      isRead: false,
      isArchived: false,
      channel: NotificationChannel.IN_APP,
      packageId: packageItem.id,
      sentAt: new Date()
    });
    
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

/**
 * Report an issue with a package
 */
export const reportIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const packageId = req.params.id;
    const userId = req.user.id;
    const { issueType, description } = req.body;
    
    if (!issueType || !description) {
      return next(new BadRequestError('Issue type and description are required'));
    }
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user is involved with this package
    if (packageItem.senderId !== userId && packageItem.carrierId !== userId && req.user.role !== 'admin') {
      return next(new ForbiddenError('You are not authorized to report issues for this package'));
    }
    
    // Create an issue record (assuming you have an Issue model)
    // This would typically be in a separate model
    const issue = await PackageIssue.create({
      packageId,
      reportedBy: userId,
      issueType,
      description,
      status: 'pending', // Default status
      resolution: null,
      resolvedAt: null
    });
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: packageItem.status,
      description: `Issue reported: ${issueType}`,
      userId: userId
    });
    
    // Notify the other party
    const recipientId = packageItem.senderId === userId ? packageItem.carrierId : packageItem.senderId;
    
    if (recipientId) {
      await Notification.create({
        userId: recipientId,
        type: NotificationType.ISSUE_REPORTED,
        title: 'Package Issue Reported',
        message: `An issue has been reported for package ${packageItem.title}`,
        data: JSON.stringify({ packageId: packageItem.id, issueId: issue.id }),
        isRead: false,
        isArchived: false,
        channel: NotificationChannel.IN_APP,
        packageId: packageItem.id,
        sentAt: new Date()
      });
    }
    
    // Always notify admin
    // Find admin users and notify them
    // This is a simplified example
    const adminUsers = await User.findAll({
      where: { role: 'admin' }
    });
    
    for (const admin of adminUsers) {
      await Notification.create({
        userId: admin.id,
        type: NotificationType.ISSUE_REPORTED,
        title: 'Package Issue Reported',
        message: `An issue has been reported for package ${packageItem.title}`,
        data: JSON.stringify({ packageId: packageItem.id, issueId: issue.id }),
        isRead: false,
        isArchived: false,
        channel: NotificationChannel.IN_APP,
        packageId: packageItem.id,
        sentAt: new Date()
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      data: issue
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
    const userId = req.user.id;
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user is involved with this package
    if (packageItem.senderId !== userId && packageItem.carrierId !== userId && req.user.role !== 'admin') {
      return next(new ForbiddenError('You are not authorized to view this package timeline'));
    }
    
    // Get package timeline
    const timeline = await PackageTimeline.findAll({
      where: { packageId },
      order: [['createdAt', 'ASC']]
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
    const userId = req.user.id;
    
    // Check if file was uploaded
    if (!req.file) {
      return next(new BadRequestError('No image file provided'));
    }
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
    if (!packageItem) {
      return next(new NotFoundError('Package not found'));
    }
    
    // Check if user has permission to upload image
    if (packageItem.senderId !== userId && packageItem.carrierId !== userId && req.user.role !== 'admin') {
      return next(new ForbiddenError('You do not have permission to upload images for this package'));
    }
    
    // Upload image to S3 (assuming you have this utility function)
    const imageUrl = await uploadToS3(req.file, `packages/${packageId}`);
    
    // Update package with image URL
    await packageItem.update({ imageUrl });
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: packageItem.status,
      description: 'Package image uploaded',
      userId: userId
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
    const carrierId = req.user.id;
    
    // Find the package
    const packageItem = await Package.findByPk(packageId);
    
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
    await packageItem.update({
      status: PackageStatus.DELIVERED,
      deliveryTime: new Date()
    });
    
    // Add timeline entry
    await PackageTimeline.create({
      packageId: packageItem.id,
      status: PackageStatus.DELIVERED,
      description: 'Package delivered by carrier',
      userId: carrierId
    });
    
    // Create notification for the sender
    await Notification.create({
      userId: packageItem.senderId,
      type: NotificationType.PACKAGE_DELIVERED,
      title: 'Package Delivered',
      message: `Your package ${packageItem.title} has been delivered`,
      data: JSON.stringify({ packageId: packageItem.id }),
      isRead: false,
      isArchived: false,
      channel: NotificationChannel.IN_APP,
      packageId: packageItem.id,
      sentAt: new Date()
    });
    
    // Send email notification to sender
    sendEmail(
      req.user.email,
      'Package Delivered',
      `Your package "${packageItem.title}" has been delivered. Please confirm the delivery in the app.`
    ).catch(err => logger.error('Failed to send email notification:', err));
    
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