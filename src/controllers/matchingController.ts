import { Request, Response } from 'express';
import { mlMatchingService } from '../utils/mlMatchingService';
import { MatchingRequest, Package, Carrier } from '../models/types';

/**
 * Controller for handling package-carrier matching operations
 */
export class MatchingController {
  /**
   * Find matches for a specific package
   * @param req Express request object
   * @param res Express response object
   */
  public async findMatchesForPackage(req: Request, res: Response): Promise<void> {
    try {
      const { packageId, minMatchScore, maxResults } = req.body;
      
      if (!packageId) {
        res.status(400).json({ error: 'Package ID is required' });
        return;
      }
      
      const request: MatchingRequest = {
        packageId,
        minMatchScore,
        maxResults
      };
      
      const result = mlMatchingService.findMatchesForPackage(request);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error finding matches for package:', error);
      res.status(500).json({ error: 'Failed to find matches for package' });
    }
  }
  
  /**
   * Find matches for a specific carrier
   * @param req Express request object
   * @param res Express response object
   */
  public async findMatchesForCarrier(req: Request, res: Response): Promise<void> {
    try {
      const { carrierId, minMatchScore, maxResults } = req.body;
      
      if (!carrierId) {
        res.status(400).json({ error: 'Carrier ID is required' });
        return;
      }
      
      const request: MatchingRequest = {
        carrierId,
        minMatchScore,
        maxResults
      };
      
      const result = mlMatchingService.findMatchesForCarrier(request);
      
      res.status(200).json(result);
    } catch (error) {
      console.error('Error finding matches for carrier:', error);
      res.status(500).json({ error: 'Failed to find matches for carrier' });
    }
  }
  
  /**
   * Run a batch matching operation to match all available packages and carriers
   * @param req Express request object
   * @param res Express response object
   */
  public async runBatchMatching(req: Request, res: Response): Promise<void> {
    try {
      const matches = mlMatchingService.runBatchMatching();
      
      res.status(200).json({
        matches,
        count: matches.length,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error running batch matching:', error);
      res.status(500).json({ error: 'Failed to run batch matching' });
    }
  }
  
  /**
   * Add a new package to the matching system
   * @param req Express request object
   * @param res Express response object
   */
  public async addPackage(req: Request, res: Response): Promise<void> {
    try {
      const packageData: Package = req.body;
      
      if (!packageData || !packageData.id) {
        res.status(400).json({ error: 'Valid package data with ID is required' });
        return;
      }
      
      mlMatchingService.addPackage(packageData);
      
      res.status(201).json({
        message: 'Package added successfully',
        packageId: packageData.id
      });
    } catch (error) {
      console.error('Error adding package:', error);
      res.status(500).json({ error: 'Failed to add package' });
    }
  }
  
  /**
   * Add a new carrier to the matching system
   * @param req Express request object
   * @param res Express response object
   */
  public async addCarrier(req: Request, res: Response): Promise<void> {
    try {
      const carrierData: Carrier = req.body;
      
      if (!carrierData || !carrierData.id) {
        res.status(400).json({ error: 'Valid carrier data with ID is required' });
        return;
      }
      
      mlMatchingService.addCarrier(carrierData);
      
      res.status(201).json({
        message: 'Carrier added successfully',
        carrierId: carrierData.id
      });
    } catch (error) {
      console.error('Error adding carrier:', error);
      res.status(500).json({ error: 'Failed to add carrier' });
    }
  }
  
  /**
   * Accept a match
   * @param req Express request object
   * @param res Express response object
   */
  public async acceptMatch(req: Request, res: Response): Promise<void> {
    try {
      const { matchId, carrierId } = req.body;
      
      if (!matchId || !carrierId) {
        res.status(400).json({ error: 'Match ID and carrier ID are required' });
        return;
      }
      
      const updatedMatch = mlMatchingService.acceptMatch(matchId, carrierId);
      
      res.status(200).json({
        message: 'Match accepted successfully',
        match: updatedMatch
      });
    } catch (error) {
      console.error('Error accepting match:', error);
      res.status(500).json({ error: 'Failed to accept match' });
    }
  }
  
  /**
   * Complete a match
   * @param req Express request object
   * @param res Express response object
   */
  public async completeMatch(req: Request, res: Response): Promise<void> {
    try {
      const { 
        matchId, 
        carrierId, 
        successful = true, 
        completionTime,
        customerRating 
      } = req.body;
      
      if (!matchId || !carrierId) {
        res.status(400).json({ error: 'Match ID and carrier ID are required' });
        return;
      }
      
      const updatedMatch = mlMatchingService.completeMatch(
        matchId, 
        carrierId, 
        successful, 
        completionTime,
        customerRating
      );
      
      res.status(200).json({
        message: 'Match completed successfully',
        match: updatedMatch
      });
    } catch (error) {
      console.error('Error completing match:', error);
      res.status(500).json({ error: 'Failed to complete match' });
    }
  }
  
  /**
   * Get all matches
   * @param req Express request object
   * @param res Express response object
   */
  public async getAllMatches(req: Request, res: Response): Promise<void> {
    try {
      const matches = mlMatchingService.getAllMatches();
      
      res.status(200).json({
        matches,
        count: matches.length
      });
    } catch (error) {
      console.error('Error getting all matches:', error);
      res.status(500).json({ error: 'Failed to get matches' });
    }
  }
  
  /**
   * Get matches for a specific package
   * @param req Express request object
   * @param res Express response object
   */
  public async getMatchesForPackage(req: Request, res: Response): Promise<void> {
    try {
      const { packageId } = req.params;
      
      if (!packageId) {
        res.status(400).json({ error: 'Package ID is required' });
        return;
      }
      
      const matches = mlMatchingService.getMatchesForPackage(packageId);
      
      res.status(200).json({
        packageId,
        matches,
        count: matches.length
      });
    } catch (error) {
      console.error('Error getting matches for package:', error);
      res.status(500).json({ error: 'Failed to get matches for package' });
    }
  }
  
  /**
   * Get matches for a specific carrier
   * @param req Express request object
   * @param res Express response object
   */
  public async getMatchesForCarrier(req: Request, res: Response): Promise<void> {
    try {
      const { carrierId } = req.params;
      
      if (!carrierId) {
        res.status(400).json({ error: 'Carrier ID is required' });
        return;
      }
      
      const matches = mlMatchingService.getMatchesForCarrier(carrierId);
      
      res.status(200).json({
        carrierId,
        matches,
        count: matches.length
      });
    } catch (error) {
      console.error('Error getting matches for carrier:', error);
      res.status(500).json({ error: 'Failed to get matches for carrier' });
    }
  }
}

// Export singleton instance of the controller
export const matchingController = new MatchingController();