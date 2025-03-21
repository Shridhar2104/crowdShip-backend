// import { Timestamp } from 'firebase-admin/firestore';
// import {
//   createDocument,
//   getDocument,
//   updateDocument,
//   queryDocuments,
//   deleteDocument,
//   setDocument
// } from '../config/database';
// import {
//   Notification,
//   NotificationType,
//   NotificationChannel,
//   NotificationPriority,
//   prepareNotificationData,
//   createNotification
// } from './notificationModel';

// // Collection names
// const NOTIFICATIONS_COLLECTION = 'notifications';
// const USERS_COLLECTION = 'users';

// /**
//  * Create a new notification
//  */
// export async function addNotification(notificationData: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
//   // Prepare notification data with defaults
//   const preparedData = prepareNotificationData(notificationData);
  
//   // Add to database (createDocument will handle timestamps)
//   const notificationId = await createDocument(NOTIFICATIONS_COLLECTION, preparedData);
  
//   // Get the complete notification document
//   const newNotification = await getDocument(NOTIFICATIONS_COLLECTION, notificationId);
  
//   return newNotification;
// }

// /**
//  * Get a notification by ID
//  */
// export async function getNotificationById(notificationId: string): Promise<Notification | null> {
//   return getDocument(NOTIFICATIONS_COLLECTION, notificationId);
// }

// /**
//  * Update a notification
//  */
// export async function updateNotification(
//   notificationId: string, 
//   updates: Partial<Notification>
// ): Promise<Notification | null> {
//   // Get existing notification
//   const notification = await getNotificationById(notificationId);
//   if (!notification) {
//     return null;
//   }
  
//   // Cannot update certain fields
//   const { id, createdAt, updatedAt, ...validUpdates } = updates as any;
  
//   // Update the notification
//   await updateDocument(NOTIFICATIONS_COLLECTION, notificationId, validUpdates);
  
//   // Get the updated notification
//   return getNotificationById(notificationId);
// }

// /**
//  * Delete a notification
//  */
// export async function deleteNotification(notificationId: string): Promise<boolean> {
//   // Get the notification first to check if it exists
//   const notification = await getNotificationById(notificationId);
//   if (!notification) {
//     return false;
//   }
  
//   // Delete the notification
//   await deleteDocument(NOTIFICATIONS_COLLECTION, notificationId);
  
//   return true;
// }

// /**
//  * Mark a notification as read
//  */
// export async function markNotificationAsRead(notificationId: string): Promise<Notification | null> {
//   return updateNotification(notificationId, {
//     isRead: true,
//     readAt: Timestamp.now()
//   });
// }

// /**
//  * Mark a notification as archived
//  */
// export async function archiveNotification(notificationId: string): Promise<Notification | null> {
//   return updateNotification(notificationId, {
//     isArchived: true
//   });
// }

// /**
//  * Get notifications for a user
//  */
// export async function getUserNotifications(
//   userId: string,
//   filters: {
//     isRead?: boolean;
//     isArchived?: boolean;
//     type?: NotificationType;
//   } = {},
//   pagination: {
//     limit?: number;
//     page?: number;
//   } = {},
//   ordering: {
//     field?: string;
//     direction?: 'asc' | 'desc';
//   } = {}
// ): Promise<{
//   notifications: Notification[];
//   unreadCount: number;
//   totalCount: number;
// }> {
//   const { isRead, isArchived, type } = filters;
//   const { limit = 20, page = 1 } = pagination;
//   const { field = 'createdAt', direction = 'desc' } = ordering;
  
//   // Build queries
//   const queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [
//     ['userId', '==', userId]
//   ];
  
//   if (isRead !== undefined) {
//     queries.push(['isRead', '==', isRead]);
//   }
  
//   if (isArchived !== undefined) {
//     queries.push(['isArchived', '==', isArchived]);
//   }
  
//   if (type) {
//     queries.push(['type', '==', type]);
//   }
  
//   // Get all matching notifications to determine total count
//   const allNotifications = await queryDocuments(NOTIFICATIONS_COLLECTION, queries);
  
//   // Count unread notifications
//   const unreadCount = allNotifications.filter(notification => !notification.isRead).length;
  
//   // Apply pagination and ordering
//   const notifications = await queryDocuments(
//     NOTIFICATIONS_COLLECTION,
//     queries,
//     { field, direction },
//     limit
//   );
  
//   return {
//     notifications: notifications.slice((page - 1) * limit, page * limit),
//     unreadCount,
//     totalCount: allNotifications.length
//   };
// }

// /**
//  * Mark all notifications for a user as read
//  */
// export async function markAllNotificationsAsRead(userId: string): Promise<number> {
//   // Get all unread notifications for this user
//   const unreadNotifications = await queryDocuments(NOTIFICATIONS_COLLECTION, [
//     ['userId', '==', userId],
//     ['isRead', '==', false]
//   ]);
  
//   // Mark each as read
//   const now = Timestamp.now();
//   const updatePromises = unreadNotifications.map(notification => 
//     updateDocument(NOTIFICATIONS_COLLECTION, notification.id, {
//       isRead: true,
//       readAt: now
//     })
//   );
  
//   await Promise.all(updatePromises);
  
//   return unreadNotifications.length;
// }

// /**
//  * Send a notification (create and potentially trigger external notifications)
//  */
// export async function sendNotification(
//   userId: string,
//   type: NotificationType,
//   customData: {
//     title?: string;
//     message?: string;
//     data?: Record<string, any>;
//     packageId?: string;
//     matchId?: string;
//     channel?: NotificationChannel;
//     priority?: NotificationPriority;
//     scheduledFor?: Date;
//     expiresAt?: Date;
//   } = {}
// ): Promise<Notification> {
//   // Create notification object
//   const notificationData = createNotification(userId, type, customData);
  
//   // Add sentAt timestamp if not scheduled for future
//   if (!notificationData.scheduledFor) {
//     notificationData.sentAt = Timestamp.now();
//   }
  
//   // Store in database
//   const notification = await addNotification(notificationData);
  
//   // Handle sending through different channels
//   if (notificationData.channel === NotificationChannel.EMAIL) {
//     // TODO: Implement email sending
//     // sendEmail(userId, notification);
//   }
  
//   if (notificationData.channel === NotificationChannel.SMS) {
//     // TODO: Implement SMS sending
//     // sendSMS(userId, notification);
//   }
  
//   if (notificationData.channel === NotificationChannel.PUSH) {
//     // TODO: Implement push notification
//     // sendPushNotification(userId, notification);
//   }
  
//   return notification;
// }

// /**
//  * Get notifications for a package
//  */
// export async function getPackageNotifications(packageId: string): Promise<Notification[]> {
//   return queryDocuments(NOTIFICATIONS_COLLECTION, [
//     ['packageId', '==', packageId]
//   ], { field: 'createdAt', direction: 'desc' });
// }

// /**
//  * Get notifications for a match
//  */
// export async function getMatchNotifications(matchId: string): Promise<Notification[]> {
//   return queryDocuments(NOTIFICATIONS_COLLECTION, [
//     ['matchId', '==', matchId]
//   ], { field: 'createdAt', direction: 'desc' });
// }

// /**
//  * Delete all notifications for a user (use with caution)
//  */
// export async function deleteAllUserNotifications(userId: string): Promise<number> {
//   const notifications = await queryDocuments(NOTIFICATIONS_COLLECTION, [
//     ['userId', '==', userId]
//   ]);
  
//   const deletePromises = notifications.map(notification => 
//     deleteDocument(NOTIFICATIONS_COLLECTION, notification.id)
//   );
  
//   await Promise.all(deletePromises);
  
//   return notifications.length;
// }

// /**
//  * Process scheduled notifications that are due
//  */
// export async function processScheduledNotifications(): Promise<number> {
//   const now = Timestamp.now();
  
//   // Find notifications scheduled for now or earlier
//   const scheduledNotifications = await queryDocuments(NOTIFICATIONS_COLLECTION, [
//     ['scheduledFor', '<=', now],
//     ['sentAt', '==', null]
//   ]);
  
//   // Mark them as sent
//   const updatePromises = scheduledNotifications.map(notification => 
//     updateDocument(NOTIFICATIONS_COLLECTION, notification.id, {
//       sentAt: now
//     })
//   );
  
//   await Promise.all(updatePromises);
  
//   return scheduledNotifications.length;
// }

// /**
//  * Clean up expired notifications
//  */
// export async function cleanupExpiredNotifications(): Promise<number> {
//   const now = Timestamp.now();
  
//   // Find expired notifications
//   const expiredNotifications = await queryDocuments(NOTIFICATIONS_COLLECTION, [
//     ['expiresAt', '<=', now]
//   ]);
  
//   // Delete them
//   const deletePromises = expiredNotifications.map(notification => 
//     deleteDocument(NOTIFICATIONS_COLLECTION, notification.id)
//   );
  
//   await Promise.all(deletePromises);
  
//   return expiredNotifications.length;
// }