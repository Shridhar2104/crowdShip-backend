import express, { Router, Request, Response, NextFunction } from 'express'; 
import { authenticate, authorize } from '../middleware/authMiddlerware'; 
import * as ratingController from '../controllers/ratingController';

const router: Router = express.Router();

// Wrapper function to handle async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * @route   POST /api/v1/ratings
 * @desc    Create a new rating
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.createRating(req, res);
}));

/**
 * @route   GET /api/v1/ratings
 * @desc    Get all ratings (admin only)
 * @access  Private (admin)
 */
router.get('/', authenticate, authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await ratingController.getAllRatings(req, res);
}));

/**
 * @route   GET /api/v1/ratings/me
 * @desc    Get current user's received ratings
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.getUserRatings(req, res);
}));

/**
 * @route   GET /api/v1/ratings/given
 * @desc    Get ratings given by current user
 * @access  Private
 */
router.get('/given', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.getGivenRatings(req, res);
}));

/**
 * @route   GET /api/v1/ratings/:id
 * @desc    Get rating by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.getRatingById(req, res);
}));

/**
 * @route   PUT /api/v1/ratings/:id
 * @desc    Update a rating (admin or rating author)
 * @access  Private
 */
router.put('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.updateRating(req, res);
}));

/**
 * @route   DELETE /api/v1/ratings/:id
 * @desc    Delete a rating (admin only)
 * @access  Private (admin)
 */
router.delete('/:id', authenticate, authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await ratingController.deleteRating(req, res);
}));

/**
 * @route   GET /api/v1/ratings/user/:userId
 * @desc    Get ratings for a specific user
 * @access  Private
 */
router.get('/user/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.getUserRatingsById(req, res);
}));

/**
 * @route   GET /api/v1/ratings/package/:packageId
 * @desc    Get ratings for a specific package
 * @access  Private
 */
router.get('/package/:packageId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.getPackageRatings(req, res);
}));

/**
 * @route   POST /api/v1/ratings/:id/report
 * @desc    Report an inappropriate rating
 * @access  Private
 */
router.post('/:id/report', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.reportRating(req, res);
}));

/**
 * @route   POST /api/v1/ratings/:id/review
 * @desc    Admin review of a rating
 * @access  Private (admin)
 */
router.post('/:id/review', authenticate, authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await ratingController.reviewRating(req, res);
}));

/**
 * @route   GET /api/v1/ratings/summary/user/:userId
 * @desc    Get rating summary for a user
 * @access  Private
 */
router.get('/summary/user/:userId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await ratingController.getUserRatingSummary(req, res);
}));

export default router;