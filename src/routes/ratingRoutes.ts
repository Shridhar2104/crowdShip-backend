import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as ratingController from '../controllers/ratingController';

const router: Router = express.Router();

/**
 * @route   POST /api/v1/ratings
 * @desc    Create a new rating
 * @access  Private
 */
router.post('/', authenticate, ratingController.createRating);

/**
 * @route   GET /api/v1/ratings
 * @desc    Get all ratings (admin only)
 * @access  Private (admin)
 */
router.get('/', authenticate, authorize(['admin']), ratingController.getAllRatings);

/**
 * @route   GET /api/v1/ratings/me
 * @desc    Get current user's received ratings
 * @access  Private
 */
router.get('/me', authenticate, ratingController.getUserRatings);

/**
 * @route   GET /api/v1/ratings/given
 * @desc    Get ratings given by current user
 * @access  Private
 */
router.get('/given', authenticate, ratingController.getGivenRatings);

/**
 * @route   GET /api/v1/ratings/:id
 * @desc    Get rating by ID
 * @access  Private
 */
router.get('/:id', authenticate, ratingController.getRatingById);

/**
 * @route   PUT /api/v1/ratings/:id
 * @desc    Update a rating (admin or rating author)
 * @access  Private
 */
router.put('/:id', authenticate, ratingController.updateRating);

/**
 * @route   DELETE /api/v1/ratings/:id
 * @desc    Delete a rating (admin only)
 * @access  Private (admin)
 */
router.delete('/:id', authenticate, authorize(['admin']), ratingController.deleteRating);

/**
 * @route   GET /api/v1/ratings/user/:userId
 * @desc    Get ratings for a specific user
 * @access  Private
 */
router.get('/user/:userId', authenticate, ratingController.getUserRatingsById);

/**
 * @route   GET /api/v1/ratings/package/:packageId
 * @desc    Get ratings for a specific package
 * @access  Private
 */
router.get('/package/:packageId', authenticate, ratingController.getPackageRatings);

/**
 * @route   POST /api/v1/ratings/:id/report
 * @desc    Report an inappropriate rating
 * @access  Private
 */
router.post('/:id/report', authenticate, ratingController.reportRating);

/**
 * @route   POST /api/v1/ratings/:id/review
 * @desc    Admin review of a rating
 * @access  Private (admin)
 */
router.post('/:id/review', authenticate, authorize(['admin']), ratingController.reviewRating);

/**
 * @route   GET /api/v1/ratings/summary/user/:userId
 * @desc    Get rating summary for a user
 * @access  Private
 */
router.get('/summary/user/:userId', authenticate, ratingController.getUserRatingSummary);

export default router;