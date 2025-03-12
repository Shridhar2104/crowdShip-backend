import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as routeController from '../controllers/routeController';

const router: Router = express.Router();

/**
 * @route   POST /api/v1/routes
 * @desc    Create a new route
 * @access  Private (carrier)
 */
router.post('/', authenticate, authorize(['carrier']), routeController.createRoute);

/**
 * @route   GET /api/v1/routes
 * @desc    Get all routes (filtered by query params)
 * @access  Private
 */
router.get('/', authenticate, routeController.getRoutes);

/**
 * @route   GET /api/v1/routes/me
 * @desc    Get current carrier's routes
 * @access  Private (carrier)
 */
router.get('/me', authenticate, authorize(['carrier']), routeController.getCarrierRoutes);

/**
 * @route   GET /api/v1/routes/:id
 * @desc    Get route by ID
 * @access  Private
 */
router.get('/:id', authenticate, routeController.getRouteById);

/**
 * @route   PUT /api/v1/routes/:id
 * @desc    Update route
 * @access  Private (carrier)
 */
router.put('/:id', authenticate, authorize(['carrier']), routeController.updateRoute);

/**
 * @route   DELETE /api/v1/routes/:id
 * @desc    Delete route
 * @access  Private (carrier)
 */
router.delete('/:id', authenticate, authorize(['carrier']), routeController.deleteRoute);

/**
 * @route   PUT /api/v1/routes/:id/activate
 * @desc    Activate route
 * @access  Private (carrier)
 */
router.put('/:id/activate', authenticate, authorize(['carrier']), routeController.activateRoute);

/**
 * @route   PUT /api/v1/routes/:id/deactivate
 * @desc    Deactivate route
 * @access  Private (carrier)
 */
router.put('/:id/deactivate', authenticate, authorize(['carrier']), routeController.deactivateRoute);

/**
 * @route   POST /api/v1/routes/check-compatibility
 * @desc    Check route compatibility with a package
 * @access  Private
 */
router.post('/check-compatibility', authenticate, routeController.checkRouteCompatibility);

/**
 * @route   GET /api/v1/routes/nearby-packages
 * @desc    Get packages compatible with carrier's routes
 * @access  Private (carrier)
 */
router.get('/nearby-packages', authenticate, authorize(['carrier']), routeController.getNearbyPackages);

/**
 * @route   POST /api/v1/routes/:id/update-location
 * @desc    Update current location on route
 * @access  Private (carrier)
 */
router.post('/:id/update-location', authenticate, authorize(['carrier']), routeController.updateLocation);

export default router;