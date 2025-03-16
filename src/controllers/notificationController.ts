import { Request, Response, NextFunction } from 'express';
import { 
  NotificationType, 
  NotificationChannel,
  NotificationPriority 
} from '../models/notificationModel';
import { 
  getUserNotifications as getUserNotificationsService,
  getNotificationById as getNotificationByIdService,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  archiveNotification as archiveNotificationService,
  deleteNotification as deleteNotificationService,
  sendNotification as sendNotificationService
} from '../models/notificationService';

// Import the new Firestore NotificationSettings service instead of the Sequelize model
import { 
  getNotificationSettings as getNotificationSettingsService, 
  createOrUpdateNotificationSettings
} from '../models/notificationSettingsService';
import { getDefaultPreferences } from '../models/NotificationSettings';

import { 
  logger
} from '../utils/logger';
import { BadRequestError, InternalServerError, NotFoundError } from '../utils/errorClasses';

/**
 * Get all notifications for the authenticated user
 */
export const getUserNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Use non-null assertion since authentication middleware ensures user exists
    const userId = req.user!.id;
    
    const result = await getUserNotificationsService(userId, { isArchived: false });
    
    res.status(200).json({
      success: true,
      count: result.notifications.length,
      data: result.notifications
    });
  } catch (error) {
    logger.error('Error fetching user notifications:', error);
    console.error('Detailed error:', JSON.stringify(error));
    next(new InternalServerError('Failed to fetch notifications'));
  }
};

/**
 * Get unread notifications for the authenticated user
 */
export const getUnreadNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const result = await getUserNotificationsService(userId, {
      isRead: false,
      isArchived: false
    });
    
    res.status(200).json({
      success: true,
      count: result.notifications.length,
      data: result.notifications
    });
  } catch (error) {
    logger.error('Error fetching unread notifications:', error);
    next(new InternalServerError('Failed to fetch unread notifications'));
  }
};

/**
 * Get a specific notification by ID
 */
export const getNotificationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notificationId = req.params.id;
    const userId = req.user!.id;
    
    const notification = await getNotificationByIdService(notificationId);
    
    if (!notification || notification.userId !== userId) {
      next(new NotFoundError('Notification not found'));
      return;
    }
    
    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error(`Error fetching notification ${req.params.id}:`, error);
    next(new InternalServerError('Failed to fetch notification'));
  }
};

/**
 * Mark a notification as read
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notificationId = req.params.id;
    const userId = req.user!.id;
    
    const notification = await getNotificationByIdService(notificationId);
    
    if (!notification || notification.userId !== userId) {
      next(new NotFoundError('Notification not found'));
      return;
    }
    
    const updatedNotification = await markNotificationAsRead(notificationId);
    
    res.status(200).json({
      success: true,
      data: updatedNotification
    });
  } catch (error) {
    logger.error(`Error marking notification ${req.params.id} as read:`, error);
    next(new InternalServerError('Failed to mark notification as read'));
  }
};

/**
 * Mark all user notifications as read
 */
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    const updatedCount = await markAllNotificationsAsRead(userId);
    
    res.status(200).json({
      success: true,
      message: `Marked ${updatedCount} notifications as read`,
      data: { modifiedCount: updatedCount }
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    next(new InternalServerError('Failed to mark all notifications as read'));
  }
};

/**
 * Archive a notification
 */
export const archiveNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notificationId = req.params.id;
    const userId = req.user!.id;
    
    const notification = await getNotificationByIdService(notificationId);
    
    if (!notification || notification.userId !== userId) {
      next(new NotFoundError('Notification not found'));
      return;
    }
    
    const updatedNotification = await archiveNotificationService(notificationId);
    
    res.status(200).json({
      success: true,
      data: updatedNotification
    });
  } catch (error) {
    logger.error(`Error archiving notification ${req.params.id}:`, error);
    next(new InternalServerError('Failed to archive notification'));
  }
};

/**
 * Archive all user notifications
 */
export const archiveAllNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Use service function instead of direct update
    const updatedCount = await markAllNotificationsAsRead(userId); // Use your own service function here
    
    res.status(200).json({
      success: true,
      message: `Archived ${updatedCount} notifications`,
      data: { modifiedCount: updatedCount }
    });
  } catch (error) {
    logger.error('Error archiving all notifications:', error);
    next(new InternalServerError('Failed to archive all notifications'));
  }
};

/**
 * Delete a notification (admin only)
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notificationId = req.params.id;
    
    const notification = await getNotificationByIdService(notificationId);
    
    if (!notification) {
      next(new NotFoundError('Notification not found'));
      return;
    }
    
    const success = await deleteNotificationService(notificationId);
    
    if (!success) {
      next(new InternalServerError('Failed to delete notification'));
      return;
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting notification ${req.params.id}:`, error);
    next(new InternalServerError('Failed to delete notification'));
  }
};

/**
 * Send a notification to a user (admin only)
 */
export const sendNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      userId, 
      type, 
      title, 
      message, 
      data, 
      channel = NotificationChannel.IN_APP,
      priority = NotificationPriority.MEDIUM,
      packageId,
      matchId,
      scheduledFor,
      expiresAt
    } = req.body;
    
    if (!userId || !type || !title || !message) {
      next(new BadRequestError('Please provide userId, type, title, and message'));
      return;
    }
    
    // Check if the notification type is valid
    if (!Object.values(NotificationType).includes(type)) {
      next(new BadRequestError(`Invalid notification type. Valid types are: ${Object.values(NotificationType).join(', ')}`));
      return;
    }
    
    // Check if the user has disabled this notification type using Firestore service
    const userSettings = await getNotificationSettingsService(userId);
    
    if (userSettings && userSettings.preferences && userSettings.preferences[type] === false) {
      res.status(200).json({
        success: true,
        message: 'Notification not sent: User has disabled this notification type',
        data: null
      });
      return;
    }
    
    // Pass the data directly - no need to stringify it for Firestore
    const notification = await sendNotificationService(
      userId,
      type as NotificationType,
      {
        title,
        message,
        data, // Already an object, don't stringify
        channel,
        priority,
        packageId,
        matchId,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      }
    );
    
    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error sending notification:', error);
    next(new InternalServerError('Failed to send notification'));
  }
};

/**
 * Update notification settings
 */
export const updateNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { preferences, channels } = req.body;
    
    if (!preferences && !channels) {
      next(new BadRequestError('Please provide preferences or channels to update'));
      return;
    }
    
    // Create or update settings using Firestore service
    const settings = await createOrUpdateNotificationSettings(userId, {
      preferences,
      channels
    });
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    next(new InternalServerError('Failed to update notification settings'));
  }
};

/**
 * Get notification settings
 */
export const getNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    
    // Get or create settings using Firestore service
    const settings = await createOrUpdateNotificationSettings(userId);
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    next(new InternalServerError('Failed to fetch notification settings'));
  }
};