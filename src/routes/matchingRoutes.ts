import { Router } from 'express';
import { matchingController } from '../controllers/matchingController';

const router = Router();

/**
 * @route   POST /api/matching/package
 * @desc    Find matches for a package
 * @access  Private
 */
router.post('/package', matchingController.findMatchesForPackage);

/**
 * @route   POST /api/matching/carrier
 * @desc    Find matches for a carrier
 * @access  Private
 */
router.post('/carrier', matchingController.findMatchesForCarrier);

/**
 * @route   POST /api/matching/batch
 * @desc    Run batch matching for all packages and carriers
 * @access  Private (Admin)
 */
router.post('/batch', matchingController.runBatchMatching);

/**
 * @route   POST /api/matching/packages
 * @desc    Add a package to the matching system
 * @access  Private
 */
router.post('/packages', matchingController.addPackage);

/**
 * @route   POST /api/matching/carriers
 * @desc    Add a carrier to the matching system
 * @access  Private
 */
router.post('/carriers', matchingController.addCarrier);

/**
 * @route   POST /api/matching/accept
 * @desc    Accept a match
 * @access  Private
 */
router.post('/accept', matchingController.acceptMatch);

/**
 * @route   POST /api/matching/complete
 * @desc    Complete a match
 * @access  Private
 */
router.post('/complete', matchingController.completeMatch);

/**
 * @route   GET /api/matching/all
 * @desc    Get all matches
 * @access  Private (Admin)
 */
router.get('/all', matchingController.getAllMatches);

/**
 * @route   GET /api/matching/package/:packageId
 * @desc    Get matches for a specific package
 * @access  Private
 */
router.get('/package/:packageId', matchingController.getMatchesForPackage);

/**
 * @route   GET /api/matching/carrier/:carrierId
 * @desc    Get matches for a specific carrier
 * @access  Private
 */
router.get('/carrier/:carrierId', matchingController.getMatchesForCarrier);

export default router;