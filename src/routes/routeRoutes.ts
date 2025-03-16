import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as routeController from '../controllers/routeController';

const router: Router = express.Router();

// Wrapper function to handle async route handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * @route   POST /api/v1/routes
 * @desc    Create a new route
 * @access  Private (carrier)
 */
router.post('/', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.createRoute(req, res);
}));

/**
 * @route   GET /api/v1/routes
 * @desc    Get all routes (filtered by query params)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await routeController.getRoutes(req, res);
}));

/**
 * @route   GET /api/v1/routes/me
 * @desc    Get current carrier's routes
 * @access  Private (carrier)
 */
router.get('/me', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.getCarrierRoutes(req, res);
}));

/**
 * @route   GET /api/v1/routes/:id
 * @desc    Get route by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await routeController.getRouteById(req, res);
}));

/**
 * @route   PUT /api/v1/routes/:id
 * @desc    Update route
 * @access  Private (carrier)
 */
router.put('/:id', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.updateRoute(req, res);
}));

/**
 * @route   DELETE /api/v1/routes/:id
 * @desc    Delete route
 * @access  Private (carrier)
 */
router.delete('/:id', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.deleteRoute(req, res);
}));

/**
 * @route   PUT /api/v1/routes/:id/activate
 * @desc    Activate route
 * @access  Private (carrier)
 */
router.put('/:id/activate', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.activateRoute(req, res);
}));

/**
 * @route   PUT /api/v1/routes/:id/deactivate
 * @desc    Deactivate route
 * @access  Private (carrier)
 */
router.put('/:id/deactivate', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.deactivateRoute(req, res);
}));

/**
 * @route   POST /api/v1/routes/check-compatibility
 * @desc    Check route compatibility with a package
 * @access  Private
 */
router.post('/check-compatibility', authenticate, asyncHandler(async (req: Request, res: Response) => {
  await routeController.checkRouteCompatibility(req, res);
}));

/**
 * @route   GET /api/v1/routes/nearby-packages
 * @desc    Get packages compatible with carrier's routes
 * @access  Private (carrier)
 */
router.get('/nearby-packages', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.getNearbyPackages(req, res);
}));

/**
 * @route   POST /api/v1/routes/:id/update-location
 * @desc    Update current location on route
 * @access  Private (carrier)
 */
router.post('/:id/update-location', authenticate, authorize(['carrier']), asyncHandler(async (req: Request, res: Response) => {
  await routeController.updateLocation(req, res);
}));

export default router;