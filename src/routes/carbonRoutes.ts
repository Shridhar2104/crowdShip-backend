import express from 'express';
import { carbonEmissionController } from '../controllers/carbonEmissionController';
import { authenticate } from '../middleware/authMiddlerware';

const router = express.Router();

/**
 * Carbon Emission API Routes
 * Base path: /api/carbon
 */

// Calculate emissions for a specific delivery
router.get('/delivery/:id', carbonEmissionController.getDeliveryEmissions);

// Generate emission report for a date range
router.get('/report', carbonEmissionController.getEmissionReport);

// Get emission statistics for a carrier
router.get('/carrier/:id', carbonEmissionController.getCarrierEmissionStats);

// Generate emission badges for a carrier
router.post('/carrier/:id/badges', carbonEmissionController.generateCarrierBadges);

// Predict future emission savings
router.get('/predict', carbonEmissionController.predictEmissionSavings);

// Get total platform emission savings
router.get('/platform', carbonEmissionController.getPlatformSavings);

// Get all vehicle emission profiles
router.get('/vehicle-profiles',  carbonEmissionController.getVehicleProfiles);

// Update a vehicle emission profile
router.put('/vehicle-profiles/:id', carbonEmissionController.updateVehicleProfile);

// Add a new vehicle emission profile
router.post('/vehicle-profiles',  carbonEmissionController.addVehicleProfile);

export default router;