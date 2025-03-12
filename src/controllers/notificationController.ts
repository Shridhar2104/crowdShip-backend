import { Request, Response, NextFunction } from 'express';
import Notification, { 
  NotificationType, 
  NotificationChannel,
  NotificationPriority 
} from '../models/Notification';
import NotificationSettings from '../models/NotificationSettings';
import { 
  logger, 
} from '../utils/logger';
import { BadRequestError, InternalServerError, NotFoundError } from '../utils/errorClasses';

/**
 * Get all notifications for the authenticated user
 */
export const getUserNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    
    const notifications = await Notification.findAll({
      where: {
        userId,
        isArchived: false
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    logger.error('Error fetching user notifications:', error);
    next(new InternalServerError('Failed to fetch notifications'));
  }
};

/**
 * Get unread notifications for the authenticated user
 */
export const getUnreadNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user.id;
    
    const notifications = await Notification.findAll({
      where: {
        userId,
        isRead: false,
        isArchived: false
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
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
    const userId = req.user.id;
    
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId
      }
    });
    
    if (!notification) {
      return next(new NotFoundError('Notification not found'));
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
    const userId = req.user.id;
    
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId
      }
    });
    
    if (!notification) {
      return next(new NotFoundError('Notification not found'));
    }
    
    await notification.markAsRead();
    
    res.status(200).json({
      success: true,
      data: notification
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
    const userId = req.user.id;
    const now = new Date();
    
    const [updatedCount] = await Notification.update(
      { 
        isRead: true,
        readAt: now
      },
      {
        where: {
          userId,
          isRead: false
        }
      }
    );
    
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
    const userId = req.user.id;
    
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId
      }
    });
    
    if (!notification) {
      return next(new NotFoundError('Notification not found'));
    }
    
    await notification.archive();
    
    res.status(200).json({
      success: true,
      data: notification
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
    const userId = req.user.id;
    
    const [updatedCount] = await Notification.update(
      { isArchived: true },
      {
        where: {
          userId,
          isArchived: false
        }
      }
    );
    
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
    
    const notification = await Notification.findByPk(notificationId);
    
    if (!notification) {
      return next(new NotFoundError('Notification not found'));
    }
    
    await notification.destroy();
    
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
      return next(new BadRequestError('Please provide userId, type, title, and message'));
    }
    
    // Check if the notification type is valid
    if (!Object.values(NotificationType).includes(type)) {
      return next(new BadRequestError(`Invalid notification type. Valid types are: ${Object.values(NotificationType).join(', ')}`));
    }
    
    // Check if the user has disabled this notification type
    const userSettings = await NotificationSettings.findOne({
      where: { userId }
    });
    
    if (userSettings && userSettings.preferences && userSettings.preferences[type] === false) {
      return res.status(200).json({
        success: true,
        message: 'Notification not sent: User has disabled this notification type',
        data: null
      });
    }
    
    // Process data field - ensure it's stored as a JSON string
    const processedData = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined;
    
    const newNotification = await Notification.create({
      userId,
      type,
      title,
      message,
      data: processedData,
      channel,
      priority,
      packageId,
      matchId,
      scheduledFor,
      expiresAt,
      sentAt: new Date(),
      isRead: false,
      isArchived: false
    });
    
    // Here you would typically trigger a real-time notification
    // via Socket.IO or a push notification service based on the channel
    
    res.status(201).json({
      success: true,
      data: newNotification
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
    const userId = req.user.id;
    const { preferences, channels } = req.body;
    
    if (!preferences && !channels) {
      return next(new BadRequestError('Please provide preferences or channels to update'));
    }
    
    // Find or create settings
    let [settings, created] = await NotificationSettings.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        preferences: {
          [NotificationType.PACKAGE_CREATED]: true,
          [NotificationType.PACKAGE_MATCHED]: true,
          [NotificationType.PACKAGE_PICKUP_READY]: true,
          [NotificationType.PACKAGE_PICKED_UP]: true,
          [NotificationType.PACKAGE_IN_TRANSIT]: true,
          [NotificationType.PACKAGE_DELIVERED]: true,
          [NotificationType.PACKAGE_DELAYED]: true,
          [NotificationType.MATCH_OFFER]: true,
          [NotificationType.MATCH_ACCEPTED]: true,
          [NotificationType.MATCH_REJECTED]: true,
          [NotificationType.MATCH_EXPIRED]: true,
          [NotificationType.PAYMENT_RECEIVED]: true,
          [NotificationType.PAYMENT_FAILED]: true,
          [NotificationType.PAYOUT_SENT]: true,
          [NotificationType.RATING_RECEIVED]: true,
          [NotificationType.SYSTEM_ALERT]: true,
          [NotificationType.ACCOUNT_UPDATE]: true
        },
        channels: {
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: true,
          [NotificationChannel.SMS]: false
        }
      }
    });
    
    // Update preferences and channels if provided
    if (!created) {
      if (preferences) {
        settings.preferences = { ...settings.preferences, ...preferences };
      }
      
      if (channels) {
        settings.channels = { ...settings.channels, ...channels };
      }
      
      await settings.save();
    }
    
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
    const userId = req.user.id;
    
    // Find or create settings
    const [settings, created] = await NotificationSettings.findOrCreate({
      where: { userId },
      defaults: {
        userId,
        preferences: {
          [NotificationType.PACKAGE_CREATED]: true,
          [NotificationType.PACKAGE_MATCHED]: true,
          [NotificationType.PACKAGE_PICKUP_READY]: true,
          [NotificationType.PACKAGE_PICKED_UP]: true,
          [NotificationType.PACKAGE_IN_TRANSIT]: true,
          [NotificationType.PACKAGE_DELIVERED]: true,
          [NotificationType.PACKAGE_DELAYED]: true,
          [NotificationType.MATCH_OFFER]: true,
          [NotificationType.MATCH_ACCEPTED]: true,
          [NotificationType.MATCH_REJECTED]: true,
          [NotificationType.MATCH_EXPIRED]: true,
          [NotificationType.PAYMENT_RECEIVED]: true,
          [NotificationType.PAYMENT_FAILED]: true,
          [NotificationType.PAYOUT_SENT]: true,
          [NotificationType.RATING_RECEIVED]: true,
          [NotificationType.SYSTEM_ALERT]: true,
          [NotificationType.ACCOUNT_UPDATE]: true
        },
        channels: {
          [NotificationChannel.IN_APP]: true,
          [NotificationChannel.EMAIL]: true,
          [NotificationChannel.PUSH]: true,
          [NotificationChannel.SMS]: false
        }
      }
    });
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    next(new InternalServerError('Failed to fetch notification settings'));
  }
};