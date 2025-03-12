import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as matchingController from '../controllers/matchingController';

const router: Router = express.Router();

/**
 * @route   POST /api/v1/matches
 * @desc    Create a match manually (admin only)
 * @access  Private (admin)
 */
router.post('/', authenticate, authorize(['admin']), matchingController.createMatch);

/**
 * @route   GET /api/v1/matches
 * @desc    Get all matches (filtered by query params)
 * @access  Private
 */
router.get('/', authenticate, matchingController.getMatches);

/**
 * @route   GET /api/v1/matches/me
 * @desc    Get current user's matches
 * @access  Private
 */
router.get('/me', authenticate, matchingController.getUserMatches);

/**
 * @route   GET /api/v1/matches/:id
 * @desc    Get match by ID
 * @access  Private
 */
router.get('/:id', authenticate, matchingController.getMatchById);

/**
 * @route   POST /api/v1/matches/find-carriers
 * @desc    Find carriers for a package
 * @access  Private (sender or admin)
 */
router.post('/find-carriers', authenticate, authorize(['sender', 'admin']), matchingController.findCarriers);

/**
 * @route   POST /api/v1/matches/:id/accept
 * @desc    Accept a match (carrier)
 * @access  Private (carrier)
 */
router.post('/:id/accept', authenticate, authorize(['carrier']), matchingController.acceptMatch);

/**
 * @route   POST /api/v1/matches/:id/reject
 * @desc    Reject a match (carrier)
 * @access  Private (carrier)
 */
router.post('/:id/reject', authenticate, authorize(['carrier']), matchingController.rejectMatch);

/**
 * @route   POST /api/v1/matches/:id/cancel
 * @desc    Cancel a match
 * @access  Private
 */
router.post('/:id/cancel', authenticate, matchingController.cancelMatch);

/**
 * @route   GET /api/v1/matches/package/:packageId
 * @desc    Get matches for a specific package
 * @access  Private
 */
router.get('/package/:packageId', authenticate, matchingController.getPackageMatches);

/**
 * @route   POST /api/v1/matches/:id/verify-pickup
 * @desc    Verify package pickup with code
 * @access  Private (carrier)
 */
router.post('/:id/verify-pickup', authenticate, authorize(['carrier']), matchingController.verifyPickup);

/**
 * @route   POST /api/v1/matches/:id/verify-delivery
 * @desc    Verify package delivery with code
 * @access  Private (carrier)
 */
router.post('/:id/verify-delivery', authenticate, authorize(['carrier']), matchingController.verifyDelivery);

/**
 * @route   POST /api/v1/matches/auto-match
 * @desc    Automatically match packages with carriers (system/admin)
 * @access  Private (admin)
 */
router.post('/auto-match', authenticate, authorize(['admin']), matchingController.autoMatch);

export default router;