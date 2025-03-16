import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// Notification type enum
export enum NotificationType {
  PACKAGE_CREATED = 'package_created',
  PACKAGE_MATCHED = 'package_matched',
  PACKAGE_CANCELLED = 'package_cancelled',
  PACKAGE_PICKUP_READY = 'package_pickup_ready',
  PACKAGE_PICKED_UP = 'package_picked_up',
  PACKAGE_IN_TRANSIT = 'package_in_transit',
  PACKAGE_DELIVERED = 'package_delivered',
  PACKAGE_DELAYED = 'package_delayed',
  MATCH_OFFER = 'match_offer',
  ISSUE_REPORTED = 'issue_reported',
  MATCH_ACCEPTED = 'match_accepted',
  MATCH_REJECTED = 'match_rejected',
  MATCH_EXPIRED = 'match_expired',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  PAYOUT_SENT = 'payout_sent',
  RATING_RECEIVED = 'rating_received',
  SYSTEM_ALERT = 'system_alert',
  ACCOUNT_UPDATE = 'account_update',
  PACKAGE_UPDATED = 'package_updated',
}

// Notification channel enum
export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push'
}

// Notification priority enum
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;   // User the notification is for
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>; // Object with additional data (stored directly in Firestore)
  isRead: boolean;
  isArchived: boolean;
  channel: NotificationChannel;
  priority: NotificationPriority;
  scheduledFor?: Timestamp; // For scheduled notifications
  sentAt?: Timestamp;    // When the notification was sent
  readAt?: Timestamp;    // When the notification was read
  expiresAt?: Timestamp; // When the notification expires
  packageId?: string;
  matchId?: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

/**
 * Prepare notification data for creation
 * Note: createdAt and updatedAt will be set by the createDocument function
 */
export function prepareNotificationData(notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Omit<Notification, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    ...notificationData,
    // Default values
    isRead: notificationData.isRead ?? false,
    isArchived: notificationData.isArchived ?? false,
    channel: notificationData.channel ?? NotificationChannel.IN_APP,
    priority: notificationData.priority ?? NotificationPriority.MEDIUM
  };
}

/**
 * Check if a notification is expired
 */
export function isNotificationExpired(notification: Notification): boolean {
  return notification.expiresAt ? notification.expiresAt.toDate() < new Date() : false;
}

/**
 * Get data for a specific notification type
 */
export function getNotificationTemplate(
  type: NotificationType, 
  data: Record<string, any> = {}
): Pick<Notification, 'title' | 'message' | 'priority'> {
  switch (type) {
    case NotificationType.PACKAGE_CREATED:
      return {
        title: 'New Package Created',
        message: `Your package ${data.packageId || ''} has been created successfully.`,
        priority: NotificationPriority.MEDIUM
      };
    
    case NotificationType.PACKAGE_MATCHED:
      return {
        title: 'Package Matched',
        message: `Your package ${data.packageId || ''} has been matched with a carrier.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.PACKAGE_CANCELLED:
      return {
        title: 'Package Cancelled',
        message: `Package ${data.packageId || ''} has been cancelled.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.PACKAGE_PICKUP_READY:
      return {
        title: 'Package Ready for Pickup',
        message: `Package ${data.packageId || ''} is ready for pickup.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.PACKAGE_PICKED_UP:
      return {
        title: 'Package Picked Up',
        message: `Package ${data.packageId || ''} has been picked up by the carrier.`,
        priority: NotificationPriority.MEDIUM
      };
    
    case NotificationType.PACKAGE_IN_TRANSIT:
      return {
        title: 'Package In Transit',
        message: `Your package ${data.packageId || ''} is now in transit.`,
        priority: NotificationPriority.MEDIUM
      };
    
    case NotificationType.PACKAGE_DELIVERED:
      return {
        title: 'Package Delivered',
        message: `Package ${data.packageId || ''} has been delivered successfully.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.PACKAGE_DELAYED:
      return {
        title: 'Package Delayed',
        message: `Your package ${data.packageId || ''} has been delayed.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.MATCH_OFFER:
      return {
        title: 'New Match Offer',
        message: `You have a new match offer for package ${data.packageId || ''}.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.MATCH_ACCEPTED:
      return {
        title: 'Match Accepted',
        message: `Match for package ${data.packageId || ''} has been accepted.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.MATCH_REJECTED:
      return {
        title: 'Match Rejected',
        message: `Match for package ${data.packageId || ''} has been rejected.`,
        priority: NotificationPriority.MEDIUM
      };
    
    case NotificationType.MATCH_EXPIRED:
      return {
        title: 'Match Expired',
        message: `Match offer for package ${data.packageId || ''} has expired.`,
        priority: NotificationPriority.MEDIUM
      };
    
    case NotificationType.PAYMENT_RECEIVED:
      return {
        title: 'Payment Received',
        message: `Payment of $${data.amount || '0.00'} has been received.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.PAYMENT_FAILED:
      return {
        title: 'Payment Failed',
        message: `Your payment of $${data.amount || '0.00'} has failed.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.PAYOUT_SENT:
      return {
        title: 'Payout Sent',
        message: `Your payout of $${data.amount || '0.00'} has been sent.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.RATING_RECEIVED:
      return {
        title: 'New Rating Received',
        message: `You've received a new rating: ${data.score || '0'}/5.`,
        priority: NotificationPriority.MEDIUM
      };
    
    case NotificationType.ISSUE_REPORTED:
      return {
        title: 'Issue Reported',
        message: `An issue has been reported with package ${data.packageId || ''}.`,
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.SYSTEM_ALERT:
      return {
        title: 'System Alert',
        message: data.message || 'System alert notification.',
        priority: NotificationPriority.HIGH
      };
    
    case NotificationType.ACCOUNT_UPDATE:
      return {
        title: 'Account Updated',
        message: 'Your account information has been updated.',
        priority: NotificationPriority.MEDIUM
      };
    
    case NotificationType.PACKAGE_UPDATED:
      return {
        title: 'Package Updated',
        message: `Package ${data.packageId || ''} has been updated.`,
        priority: NotificationPriority.MEDIUM
      };
    
    default:
      return {
        title: 'Notification',
        message: 'You have a new notification.',
        priority: NotificationPriority.MEDIUM
      };
  }
}

/**
 * Create notification object with proper defaults
 */
export function createNotification(
  userId: string,
  type: NotificationType,
  customData: {
    title?: string;
    message?: string;
    data?: Record<string, any>;
    packageId?: string;
    matchId?: string;
    channel?: NotificationChannel;
    priority?: NotificationPriority;
    scheduledFor?: Date;
    expiresAt?: Date;
  } = {}
): Omit<Notification, 'id' | 'createdAt' | 'updatedAt'> {
  // Get template for this notification type
  const template = getNotificationTemplate(type, customData.data || {});
  
  // Define the notification object
  return {
    userId,
    type,
    title: customData.title || template.title,
    message: customData.message || template.message,
    data: customData.data || {},
    isRead: false,
    isArchived: false,
    channel: customData.channel || NotificationChannel.IN_APP,
    priority: customData.priority || template.priority,
    scheduledFor: customData.scheduledFor ? Timestamp.fromDate(customData.scheduledFor) : undefined,
    expiresAt: customData.expiresAt ? Timestamp.fromDate(customData.expiresAt) : undefined,
    packageId: customData.packageId,
    matchId: customData.matchId
  };
}