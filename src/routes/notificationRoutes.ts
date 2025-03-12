import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as notificationController from '../controllers/notificationController';

const router: Router = express.Router();

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/', authenticate, notificationController.getUserNotifications);

/**
 * @route   GET /api/v1/notifications/unread
 * @desc    Get user's unread notifications
 * @access  Private
 */
router.get('/unread', authenticate, notificationController.getUnreadNotifications);

/**
 * @route   GET /api/v1/notifications/:id
 * @desc    Get notification by ID
 * @access  Private
 */
router.get('/:id', authenticate, notificationController.getNotificationById);

/**
 * @route   POST /api/v1/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post('/:id/read', authenticate, notificationController.markAsRead);

/**
 * @route   POST /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.post('/read-all', authenticate, notificationController.markAllAsRead);

/**
 * @route   POST /api/v1/notifications/:id/archive
 * @desc    Archive notification
 * @access  Private
 */
router.post('/:id/archive', authenticate, notificationController.archiveNotification);

/**
 * @route   POST /api/v1/notifications/archive-all
 * @desc    Archive all notifications
 * @access  Private
 */
router.post('/archive-all', authenticate, notificationController.archiveAllNotifications);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete notification (admin only)
 * @access  Private (admin)
 */
router.delete('/:id', authenticate, authorize(['admin']), notificationController.deleteNotification);

/**
 * @route   POST /api/v1/notifications/send
 * @desc    Send notification to a user (admin only)
 * @access  Private (admin)
 */
router.post('/send', authenticate, authorize(['admin']), notificationController.sendNotification);

/**
 * @route   POST /api/v1/notifications/settings
 * @desc    Update notification settings
 * @access  Private
 */
router.post('/settings', authenticate, notificationController.updateNotificationSettings);

/**
 * @route   GET /api/v1/notifications/settings
 * @desc    Get notification settings
 * @access  Private
 */
router.get('/settings', authenticate, notificationController.getNotificationSettings);

export default router;