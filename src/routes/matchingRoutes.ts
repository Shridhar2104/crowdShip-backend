import express, { Router, Request, Response, NextFunction } from 'express'; 
import { authenticate, authorize } from '../middleware/authMiddlerware'; 
import * as matchingController from '../controllers/matchingController';

const router: Router = express.Router();


//package id----e52a4e8e-5a30-4bea-98b2-6885b660900a
//carrier id----1ae50c83-729b-4353-9e41-d44ff3c11bf6
// Wrapper function to handle async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * @route   POST /api/v1/matches
 * @desc    Create a match manually (admin only)
 * @access  Private (admin)
 */
router.post('/', authenticate, authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await matchingController.createMatch(req, res);
}));

/**
 * @route   GET /api/v1/matches
 * @desc    Get all matches (filtered by query params)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await matchingController.getMatches(req, res);
}));

/**
 * @route   GET /api/v1/matches/me
 * @desc    Get current user's matches
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await matchingController.getUserMatches(req, res);
}));

/**
 * @route   GET /api/v1/matches/:id
 * @desc    Get match by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await matchingController.getMatchById(req, res);
}));

/**
 * @route   POST /api/v1/matches/find-carriers
 * @desc    Find carriers for a package
 * @access  Private (sender or admin)
 */
router.post('/find-carriers', authenticate, authorize(['sender', 'admin']), asyncHandler(async (req: Request, res: Response) => {
  await matchingController.findCarriers(req, res);
}));

/**
 * @route   POST /api/v1/matches/:id/accept
 * @desc    Accept a match (carrier)
 * @access  Private (carrier)
 */
router.post('/:id/accept', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await matchingController.acceptMatch(req, res);
}));

/**
 * @route   POST /api/v1/matches/:id/reject
 * @desc    Reject a match (carrier)
 * @access  Private (carrier)
 */
router.post('/:id/reject', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await matchingController.rejectMatch(req, res);
}));

/**
 * @route   POST /api/v1/matches/:id/cancel
 * @desc    Cancel a match
 * @access  Private
 */
router.post('/:id/cancel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await matchingController.cancelMatch(req, res);
}));

/**
 * @route   GET /api/v1/matches/package/:packageId
 * @desc    Get matches for a specific package
 * @access  Private
 */
router.get('/package/:packageId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await matchingController.getPackageMatches(req, res);
}));

/**
 * @route   POST /api/v1/matches/:id/verify-pickup
 * @desc    Verify package pickup with code
 * @access  Private (carrier)
 */
// router.post('/:id/verify-pickup', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
//   await matchingController.verifyPickup(req, res);
// }));

/**
 * @route   POST /api/v1/matches/:id/verify-delivery
 * @desc    Verify package delivery with code
 * @access  Private (carrier)
 */
router.post('/:id/verify-delivery', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await matchingController.verifyDelivery(req, res);
}));

/**
 * @route   POST /api/v1/matches/auto-match
 * @desc    Automatically match packages with carriers (system/admin)
 * @access  Private (admin)
 */
router.post('/auto-match', authenticate, authorize(['admin']), asyncHandler(async (req: Request, res: Response) => {
  await matchingController.autoMatch(req, res);
}));

export default router;