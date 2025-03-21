import { 
    Package, 
    Carrier, 
    Match, 
    MatchingRequest, 
    MatchingResponse, MatchStatus  } from '../models/types';
  import { 
    matchingModel,
    findMatchesForPackage, 
    findMatchesForCarrier, 
    batchMatchingAlgorithm 
  } from './mlMatchingalogrithm';
  
  /**
   * ML-based Matching Service
   * Uses a trained machine learning model to provide optimal matches between
   * packages and carriers based on historical delivery data
   */
  export class MLMatchingService {
    private packages: Map<string, Package> = new Map();
    private carriers: Map<string, Carrier> = new Map();
    private matches: Map<string, Match> = new Map();
    private completedMatches: Map<string, Match> = new Map();
    
    /**
     * Add or update a package in the matching service
     * @param pkg The package to add or update
     */
    public addPackage(pkg: Package): void {
      this.packages.set(pkg.id, pkg);
    }
    
    /**
     * Add or update a carrier in the matching service
     * @param carrier The carrier to add or update
     */
    public addCarrier(carrier: Carrier): void {
      this.carriers.set(carrier.id, carrier);
    }
    
    /**
     * Remove a package from the matching service
     * @param packageId The ID of the package to remove
     */
    public removePackage(packageId: string): void {
      this.packages.delete(packageId);
      
      // Also remove any matches for this package
      for (const [matchId, match] of this.matches.entries()) {
        if (match.packageId === packageId) {
          this.matches.delete(matchId);
        }
      }
    }
    
    /**
     * Remove a carrier from the matching service
     * @param carrierId The ID of the carrier to remove
     */
    public removeCarrier(carrierId: string): void {
      this.carriers.delete(carrierId);
      
      // Also remove any matches for this carrier
      for (const [matchId, match] of this.matches.entries()) {
        if (match.carrierId === carrierId) {
          this.matches.delete(matchId);
        }
      }
    }
    
    /**
     * Find matches for a specific package using ML algorithm
     * @param request The matching request details
     * @returns A response with potential matches
     */
    public findMatchesForPackage(request: MatchingRequest): MatchingResponse {
      if (!request.packageId) {
        throw new Error('Package ID is required for this operation');
      }
      
      const pkg = this.packages.get(request.packageId);
      if (!pkg) {
        throw new Error(`Package with ID ${request.packageId} not found`);
      }
      
      // Get all active carriers
      const activeCarriers = Array.from(this.carriers.values())
        .filter(carrier => carrier.isActive);
      
      // Find matches for the package using ML model
      const matches = findMatchesForPackage(
        matchingModel,
        pkg,
        activeCarriers,
        request.minMatchScore || 0.6
      );
      
      // Limit results if specified
      const limitedMatches = request.maxResults 
        ? matches.slice(0, request.maxResults) 
        : matches;
      
      // Store matches
      limitedMatches.forEach(match => {
        this.matches.set(match.id, match);
      });
      
      return {
        matches: limitedMatches,
        requestTimestamp: new Date()
      };
    }
    
    /**
     * Find matches for a specific carrier using ML algorithm
     * @param request The matching request details
     * @returns A response with potential matches
     */
    public findMatchesForCarrier(request: MatchingRequest): MatchingResponse {
      if (!request.carrierId) {
        throw new Error('Carrier ID is required for this operation');
      }
      
      const carrier = this.carriers.get(request.carrierId);
      if (!carrier) {
        throw new Error(`Carrier with ID ${request.carrierId} not found`);
      }
      
      // Only consider packages that haven't been matched yet or are still in created status
      const availablePackages = Array.from(this.packages.values())
        .filter(pkg => pkg.status === 'CREATED');
      
      // Find matches for the carrier using ML model
      const matches = findMatchesForCarrier(
        matchingModel,
        carrier,
        availablePackages,
        request.minMatchScore || 0.6
      );
      
      // Limit results if specified
      const limitedMatches = request.maxResults 
        ? matches.slice(0, request.maxResults) 
        : matches;
      
      // Store matches
      limitedMatches.forEach(match => {
        this.matches.set(match.id, match);
      });
      
      return {
        matches: limitedMatches,
        requestTimestamp: new Date()
      };
    }
    
    /**
     * Run a batch matching operation to optimally match all available packages and carriers
     * @returns A list of proposed matches
     */
    public runBatchMatching(): Match[] {
      const availablePackages = Array.from(this.packages.values())
        .filter(pkg => pkg.status === 'CREATED');
      
      const availableCarriers = Array.from(this.carriers.values())
        .filter(carrier => carrier.isActive);
      
      // Find optimal matches between packages and carriers using ML model
      const matches = batchMatchingAlgorithm(
        matchingModel,
        availablePackages,
        availableCarriers
      );
      
      // Store the matches
      matches.forEach(match => {
        this.matches.set(match.id, match);
      });
      
      return matches;
    }
    
    /**
     * Accept a match, updating the status
     * @param matchId ID of the match to accept
     * @param carrierId ID of the carrier accepting the match (for verification)
     * @returns The updated match
     */
    public acceptMatch(matchId: string, carrierId: string): Match {
      const match = this.matches.get(matchId);
      if (!match) {
        throw new Error(`Match with ID ${matchId} not found`);
      }
      
      // Verify that the carrier is the one assigned to this match
      if (match.carrierId !== carrierId) {
        throw new Error('Carrier ID does not match the assigned carrier for this match');
      }
      
      // Update the match status
      const updatedMatch: Match = {
        ...match,
        status: 'ACCEPTED',
        acceptedAt: new Date()
      };
      
      // Save the updated match
      this.matches.set(matchId, updatedMatch);
      
      // Update the package status
      const pkg = this.packages.get(match.packageId);
      if (pkg) {
        const updatedPackage: Package = {
          ...pkg,
          status: 'SCHEDULED',
          updatedAt: new Date()
        };
        this.packages.set(pkg.id, updatedPackage);
      }
      
      return updatedMatch;
    }
    
    /**
     * Complete a match, updating the status and feeding back into the ML model
     * @param matchId ID of the match to complete
     * @param carrierId ID of the carrier completing the match (for verification)
     * @param successful Whether the delivery was successful
     * @param completionTime Time taken to complete the delivery in minutes
     * @param customerRating Rating given by the customer (1-5)
     * @returns The updated match
     */
    public completeMatch(
      matchId: string, 
      carrierId: string, 
      successful: boolean = true,
      completionTime?: number,
      customerRating?: number
    ): Match {
      const match = this.matches.get(matchId);
      if (!match) {
        throw new Error(`Match with ID ${matchId} not found`);
      }
      
      // Verify that the carrier is the one assigned to this match
      if (match.carrierId !== carrierId) {
        throw new Error('Carrier ID does not match the assigned carrier for this match');
      }
      
      // Verify that the match is in an acceptable state to complete
      if (match.status !== 'ACCEPTED' && match.status !== 'IN_PROGRESS') {
        throw new Error(`Match with status ${match.status} cannot be completed`);
      }
      
      // Update the match status
      const updatedMatch: Match = {
        ...match,
        status: successful ? 'COMPLETED' : 'FAILED',
        completedAt: new Date()
      };
      
      // Remove from active matches and add to completed matches
      this.matches.delete(matchId);
      this.completedMatches.set(matchId, updatedMatch);
      
      // Update the package status
      const pkg = this.packages.get(match.packageId);
      if (pkg) {
        const updatedPackage: Package = {
          ...pkg,
          status: successful ? 'DELIVERED' : 'FAILED',
          updatedAt: new Date()
        };
        this.packages.set(pkg.id, updatedPackage);
      }
      
      // Update carrier stats if needed
      const carrier = this.carriers.get(match.carrierId);
      if (carrier && successful) {
        const updatedCarrier: Carrier = {
          ...carrier,
          completedDeliveries: carrier.completedDeliveries + 1,
          updatedAt: new Date()
        };
        this.carriers.set(carrier.id, updatedCarrier);
      }
      
      // Feed this match result back into the ML model for training
      matchingModel.addTrainingExample(updatedMatch, successful, completionTime, customerRating);
      
      return updatedMatch;
    }
    
    /**
     * Get all current matches
     * @returns All matches in the system
     */
    public getAllMatches(): Match[] {
      return Array.from(this.matches.values());
    }
    
    /**
     * Get matches for a specific package
     * @param packageId ID of the package
     * @returns All matches for the package
     */
    public getMatchesForPackage(packageId: string): Match[] {
      return Array.from(this.matches.values())
        .filter(match => match.packageId === packageId);
    }
    
    /**
     * Get matches for a specific carrier
     * @param carrierId ID of the carrier
     * @returns All matches for the carrier
     */
    public getMatchesForCarrier(carrierId: string): Match[] {
      return Array.from(this.matches.values())
        .filter(match => match.carrierId === carrierId);
    }
    
    /**
     * Export historical delivery data for analysis and ML model improvement
     */
    public exportDeliveryData(): Match[] {
      return Array.from(this.completedMatches.values());
    }
    
    /**
     * Train the ML model on historical data
     */
    public trainModel(): void {
      matchingModel.trainModel();
    }
  }
  
  // Export a singleton instance of the ML matching service
  export const mlMatchingService = new MLMatchingService();