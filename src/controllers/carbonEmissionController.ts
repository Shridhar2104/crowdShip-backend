import { Request, Response } from 'express';
import carbonEmissionService from '../utils/CarbonEmissionService';
import { logger } from '../utils/logger';

/**
 * Controller for carbon emission related endpoints
 */
export const carbonEmissionController = {
  /**
   * Calculate and return carbon emissions for a delivery
   * @route GET /api/carbon/delivery/:id
   */
  getDeliveryEmissions: async (req: Request, res: Response): Promise<void> => {
    try {
      const deliveryId = req.params.id;
      
      if (!deliveryId) {
        res.status(400).json({ 
          success: false, 
          message: 'Delivery ID is required' 
        });
        return;
      }
      
      const emissionData = await carbonEmissionService.processDeliveryEmissions(deliveryId);
      
      res.status(200).json({
        success: true,
        data: emissionData
      });
    } catch (error: any) {
      logger.error('Error calculating delivery emissions', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to calculate carbon emissions' 
      });
    }
  },

  /**
   * Generate and return carbon emission report for a date range
   * @route GET /api/carbon/report
   */
  getEmissionReport: async (req: Request, res: Response): Promise<void> => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      if (!startDate || !endDate) {
        res.status(400).json({ 
          success: false, 
          message: 'Start date and end date are required' 
        });
        return;
      }
      
      const report = await carbonEmissionService.generateEmissionReport(startDate, endDate);
      
      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      logger.error('Error generating emission report', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to generate emission report' 
      });
    }
  },

  /**
   * Get emission statistics for a carrier
   * @route GET /api/carbon/carrier/:id
   */
  getCarrierEmissionStats: async (req: Request, res: Response): Promise<void> => {
    try {
      const carrierId = req.params.id;
      
      if (!carrierId) {
        res.status(400).json({ 
          success: false, 
          message: 'Carrier ID is required' 
        });
        return;
      }
      
      const stats = await carbonEmissionService.getCarrierEmissionStats(carrierId);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Error getting carrier emission stats', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to retrieve carrier emission statistics' 
      });
    }
  },

  /**
   * Generate emission badges for a carrier
   * @route POST /api/carbon/carrier/:id/badges
   */
  generateCarrierBadges: async (req: Request, res: Response): Promise<void> => {
    try {
      const carrierId = req.params.id;
      
      if (!carrierId) {
        res.status(400).json({ 
          success: false, 
          message: 'Carrier ID is required' 
        });
        return;
      }
      
      const badges = await carbonEmissionService.generateCarrierEmissionBadges(carrierId);
      
      res.status(200).json({
        success: true,
        data: badges
      });
    } catch (error: any) {
      logger.error('Error generating carrier emission badges', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to generate carrier emission badges' 
      });
    }
  },

  /**
   * Predict future emission savings
   * @route GET /api/carbon/predict
   */
  predictEmissionSavings: async (req: Request, res: Response): Promise<void> => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      
      if (isNaN(days) || days < 1 || days > 365) {
        res.status(400).json({ 
          success: false, 
          message: 'Days must be a number between 1 and 365' 
        });
        return;
      }
      
      const prediction = await carbonEmissionService.predictEmissionSavings(days);
      
      res.status(200).json({
        success: true,
        data: prediction
      });
    } catch (error: any) {
      logger.error('Error predicting emission savings', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to predict emission savings' 
      });
    }
  },

  /**
   * Get total platform emission savings
   * @route GET /api/carbon/platform
   */
  getPlatformSavings: async (req: Request, res: Response): Promise<void> => {
    try {
      const savings = await carbonEmissionService.getTotalPlatformSavings();
      
      res.status(200).json({
        success: true,
        data: savings
      });
    } catch (error: any) {
      logger.error('Error getting platform emission savings', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to get platform emission savings' 
      });
    }
  },

  /**
   * Get all vehicle emission profiles
   * @route GET /api/carbon/vehicle-profiles
   */
  getVehicleProfiles: async (req: Request, res: Response): Promise<void> => {
    try {
      const profiles = await carbonEmissionService.getVehicleEmissionProfiles();
      
      res.status(200).json({
        success: true,
        data: profiles
      });
    } catch (error: any) {
      logger.error('Error getting vehicle emission profiles', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to get vehicle emission profiles' 
      });
    }
  },

  /**
   * Update vehicle emission profile
   * @route PUT /api/carbon/vehicle-profiles/:id
   */
  updateVehicleProfile: async (req: Request, res: Response): Promise<void> => {
    try {
      const profileId = req.params.id;
      const profileData = req.body;
      
      if (!profileId) {
        res.status(400).json({ 
          success: false, 
          message: 'Profile ID is required' 
        });
        return;
      }
      
      // Validate emission factor
      if (profileData.emissionFactor !== undefined && 
          (isNaN(profileData.emissionFactor) || profileData.emissionFactor < 0)) {
        res.status(400).json({ 
          success: false, 
          message: 'Emission factor must be a non-negative number' 
        });
        return;
      }
      
      const success = await carbonEmissionService.updateVehicleEmissionProfile(profileId, profileData);
      
      res.status(200).json({
        success: true,
        message: 'Vehicle emission profile updated successfully'
      });
    } catch (error: any) {
      logger.error('Error updating vehicle emission profile', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to update vehicle emission profile' 
      });
    }
  },

  /**
   * Add new vehicle emission profile
   * @route POST /api/carbon/vehicle-profiles
   */
  addVehicleProfile: async (req: Request, res: Response): Promise<void> => {
    try {
      const profileData = req.body;
      
      // Validate required fields
      if (!profileData.vehicleType) {
        res.status(400).json({ 
          success: false, 
          message: 'Vehicle type is required' 
        });
        return;
      }
      
      if (profileData.emissionFactor === undefined || 
          isNaN(profileData.emissionFactor) || 
          profileData.emissionFactor < 0) {
        res.status(400).json({ 
          success: false, 
          message: 'Valid emission factor is required' 
        });
        return;
      }
      
      const profileId = await carbonEmissionService.addVehicleEmissionProfile({
        vehicleType: profileData.vehicleType,
        vehicleSize: profileData.vehicleSize || null,
        emissionFactor: profileData.emissionFactor
      });
      
      res.status(201).json({
        success: true,
        message: 'Vehicle emission profile added successfully',
        data: { id: profileId }
      });
    } catch (error: any) {
      logger.error('Error adding vehicle emission profile', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to add vehicle emission profile' 
      });
    }
  }
};