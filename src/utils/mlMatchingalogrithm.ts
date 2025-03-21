import { Package, Carrier, Match, Route, Location, DeliveryTimeWindow, MatchStatus } from '../models/types';

/**
 * Machine Learning-based Matching Algorithm for CrowdShip
 * Uses historical delivery data to train a model that predicts optimal matches
 */

interface FeatureVector {
  routeDeviationNormalized: number;          // How much the carrier deviates from their planned route
  timeWindowOverlapPercentage: number;       // Percentage of time window overlap
  carrierRatingNormalized: number;           // Normalized carrier rating (0-1)
  packageWeightToCapacityRatio: number;      // Package weight divided by carrier max weight
  packageSizeToCapacityRatio: number;        // Package size divided by carrier max size
  carrierUtilizationRatio: number;           // Current carrier load / max capacity
  carrierExperienceNormalized: number;       // Normalized carrier completed deliveries
  distanceToPickupNormalized: number;        // Distance from carrier to pickup point (normalized)
  pickupToDeliveryDistanceNormalized: number; // Distance from pickup to delivery (normalized)
  timeOfDayNormalized: number;               // Time of day normalized to 0-1 (0 = midnight, 1 = 23:59)
  dayOfWeekNormalized: number;               // Day of week normalized to 0-1 (0 = Monday, 1 = Sunday)
  isSpecialRequirement: number;              // 1 if package has special requirements, 0 otherwise
}

interface TrainingExample {
  features: FeatureVector;
  outcome: number;          // 1 for successful match, 0 for unsuccessful
  completionTime: number;   // Time to complete delivery in minutes (for regression)
  customerRating: number;   // Rating given by customer (for quality prediction)
}

interface ModelWeights {
  routeDeviation: number;
  timeWindowOverlap: number;
  carrierRating: number;
  packageWeight: number;
  packageSize: number;
  carrierUtilization: number;
  carrierExperience: number;
  distanceToPickup: number;
  pickupToDeliveryDistance: number;
  timeOfDay: number;
  dayOfWeek: number;
  specialRequirement: number;
  intercept: number;
}

/**
 * ML Model for predicting match success probability and delivery quality
 */
class MatchingModel {
  private weights: ModelWeights;
  private trainingData: TrainingExample[] = [];
  private isModelTrained: boolean = false;
  private normalizers: Map<string, { min: number; max: number }> = new Map();

  constructor() {
    // Initialize with default weights based on domain knowledge
    this.weights = {
      routeDeviation: -0.5,        // Higher deviation → lower score
      timeWindowOverlap: 0.8,      // Higher overlap → higher score
      carrierRating: 0.7,          // Higher rating → higher score
      packageWeight: -0.2,         // Higher weight ratio → lower score
      packageSize: -0.2,           // Higher size ratio → lower score
      carrierUtilization: -0.1,    // Higher utilization → slightly lower score
      carrierExperience: 0.6,      // More experience → higher score
      distanceToPickup: -0.4,      // Further pickup → lower score
      pickupToDeliveryDistance: -0.3, // Longer delivery distance → lower score
      timeOfDay: 0,                // Initialized to neutral
      dayOfWeek: 0,                // Initialized to neutral
      specialRequirement: -0.3,    // Special requirements → slightly lower score
      intercept: 0.5               // Base score
    };
  }

  /**
   * Extract features from a potential carrier-package match
   */
  private extractFeatures(carrier: Carrier, pkg: Package): FeatureVector {
    // Calculate route deviation
    const routeDeviation = this.calculateRouteDeviation(
      carrier.route,
      pkg.pickupLocation,
      pkg.deliveryLocation
    );
    
    // Calculate distance from carrier to pickup
    const distanceToPickup = this.calculateDistance(
      carrier.currentLocation,
      pkg.pickupLocation
    );
    
    // Calculate distance from pickup to delivery
    const pickupToDeliveryDistance = this.calculateDistance(
      pkg.pickupLocation,
      pkg.deliveryLocation
    );
    
    // Calculate time window overlap
    const timeOverlap = this.calculateTimeCompatibility(
      carrier.availabilityWindow,
      {
        start: pkg.pickupTimeWindow.start,
        end: pkg.deliveryTimeWindow.end
      }
    );
    
    // Time of day (hour / 24)
    const now = new Date();
    const timeOfDay = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
    
    // Day of week (0-6) normalized to 0-1
    const dayOfWeek = now.getDay() / 6;
    
    // Has special requirements
    const hasSpecialRequirements = 
      pkg.requiresRefrigeration || 
      pkg.requiresSignature || 
      pkg.isFragile ? 1 : 0;
    
    return {
      routeDeviationNormalized: this.normalize(routeDeviation, 'routeDeviation', 0, 10000),
      timeWindowOverlapPercentage: timeOverlap,
      carrierRatingNormalized: carrier.rating / 5,
      packageWeightToCapacityRatio: pkg.weight / carrier.maxWeight,
      packageSizeToCapacityRatio: pkg.size / carrier.maxSize,
      carrierUtilizationRatio: 0.5, // Placeholder - would be calculated from current carrier load
      carrierExperienceNormalized: this.normalize(carrier.completedDeliveries, 'carrierExperience', 0, 1000),
      distanceToPickupNormalized: this.normalize(distanceToPickup, 'distanceToPickup', 0, 50000),
      pickupToDeliveryDistanceNormalized: this.normalize(pickupToDeliveryDistance, 'deliveryDistance', 0, 100000),
      timeOfDayNormalized: timeOfDay,
      dayOfWeekNormalized: dayOfWeek,
      isSpecialRequirement: hasSpecialRequirements
    };
  }

  /**
   * Normalize a value to be between 0 and 1
   */
  private normalize(value: number, featureName: string, defaultMin: number, defaultMax: number): number {
    if (!this.normalizers.has(featureName)) {
      this.normalizers.set(featureName, { min: defaultMin, max: defaultMax });
    }
    
    const { min, max } = this.normalizers.get(featureName)!;
    
    // Clip the value to the range and normalize
    const clippedValue = Math.max(min, Math.min(max, value));
    return (clippedValue - min) / (max - min);
  }

  /**
   * Calculate the distance between two locations
   */
  private calculateDistance(start: Location, end: Location): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (start.latitude * Math.PI) / 180;
    const φ2 = (end.latitude * Math.PI) / 180;
    const Δφ = ((end.latitude - start.latitude) * Math.PI) / 180;
    const Δλ = ((end.longitude - start.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate the route deviation if a carrier were to pick up and deliver a package
   */
  private calculateRouteDeviation(
    carrierRoute: Route,
    pickupLocation: Location,
    deliveryLocation: Location
  ): number {
    // Calculate the distance of the original route
    const originalDistance = this.calculateDistance(carrierRoute.origin, carrierRoute.destination);
    
    // Calculate the distance with the detour
    const distanceWithDetour = 
      this.calculateDistance(carrierRoute.origin, pickupLocation) +
      this.calculateDistance(pickupLocation, deliveryLocation) +
      this.calculateDistance(deliveryLocation, carrierRoute.destination);
    
    // Return the additional distance
    return Math.max(0, distanceWithDetour - originalDistance);
  }

  /**
   * Calculate the time window compatibility between carrier and package
   */
  private calculateTimeCompatibility(
    carrierWindow: DeliveryTimeWindow,
    packageWindow: DeliveryTimeWindow
  ): number {
    // Calculate the overlap between carrier and package time windows
    const overlapStart = Math.max(carrierWindow.start.getTime(), packageWindow.start.getTime());
    const overlapEnd = Math.min(carrierWindow.end.getTime(), packageWindow.end.getTime());
    
    // If there's no overlap, return 0
    if (overlapStart > overlapEnd) return 0;
    
    // Calculate the duration of the overlap
    const overlapDuration = overlapEnd - overlapStart;
    
    // Calculate the duration of the package window
    const packageDuration = packageWindow.end.getTime() - packageWindow.start.getTime();
    
    // Return the proportion of the package window that overlaps with the carrier window
    return overlapDuration / packageDuration;
  }

  /**
   * Predict match score using current model weights
   */
  public predictMatchScore(features: FeatureVector): number {
    // Apply logistic regression model
    let score = this.weights.intercept;
    
    score += this.weights.routeDeviation * (1 - features.routeDeviationNormalized); // Invert so higher is better
    score += this.weights.timeWindowOverlap * features.timeWindowOverlapPercentage;
    score += this.weights.carrierRating * features.carrierRatingNormalized;
    score += this.weights.packageWeight * (1 - features.packageWeightToCapacityRatio); // Invert so higher is better
    score += this.weights.packageSize * (1 - features.packageSizeToCapacityRatio); // Invert so higher is better
    score += this.weights.carrierUtilization * (1 - features.carrierUtilizationRatio); // Invert so higher is better
    score += this.weights.carrierExperience * features.carrierExperienceNormalized;
    score += this.weights.distanceToPickup * (1 - features.distanceToPickupNormalized); // Invert so higher is better
    score += this.weights.pickupToDeliveryDistance * (1 - features.pickupToDeliveryDistanceNormalized); // Invert so higher is better
    score += this.weights.timeOfDay * features.timeOfDayNormalized;
    score += this.weights.dayOfWeek * features.dayOfWeekNormalized;
    score += this.weights.specialRequirement * features.isSpecialRequirement;
    
    // Apply sigmoid function to get probability between 0 and 1
    const probability = 1 / (1 + Math.exp(-score));
    
    return probability;
  }

  /**
   * Add a training example to the model
   */
  public addTrainingExample(match: Match, successful: boolean, completionTime?: number, customerRating?: number): void {
    // In a real implementation, we would retrieve the carrier and package details
    // from a database using match.carrierId and match.packageId
    // For now, we'll simulate this with placeholder data
    
    // This would be replaced with actual data in a real implementation
    const mockCarrier: Carrier = {
      id: match.carrierId,
      userId: 'user123',
      vehicleType: 'CAR',
      maxWeight: 50,
      maxSize: 100,
      maxPackages: 5,
      hasRefrigeration: false,
      rating: 4.5,
      completedDeliveries: 120,
      route: {
        origin: { latitude: 37.7749, longitude: -122.4194 },
        destination: { latitude: 37.3352, longitude: -121.8811 }
      },
      availabilityWindow: {
        start: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        end: new Date(Date.now() + 2 * 60 * 60 * 1000)   // 2 hours from now
      },
      currentLocation: { latitude: 37.5, longitude: -122.1 },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const mockPackage: Package = {
      id: match.packageId,
      senderId: 'sender123',
      recipientId: 'recipient123',
      weight: 10,
      size: 30,
      requiresSignature: false,
      requiresRefrigeration: false,
      isFragile: false,
      pickupLocation: { latitude: 37.6, longitude: -122.2 },
      deliveryLocation: { latitude: 37.4, longitude: -121.9 },
      pickupTimeWindow: {
        start: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        end: new Date(Date.now() + 1 * 60 * 60 * 1000)   // 1 hour from now
      },
      deliveryTimeWindow: {
        start: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
        end: new Date(Date.now() + 3 * 60 * 60 * 1000)   // 3 hours from now
      },
      status: 'DELIVERED',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      updatedAt: new Date()
    };
    
    // Extract features from the mock data
    const features = this.extractFeatures(mockCarrier, mockPackage);
    
    // Create the training example
    const example: TrainingExample = {
      features,
      outcome: successful ? 1 : 0,
      completionTime: completionTime || 0,
      customerRating: customerRating || 0
    };
    
    // Add to training data
    this.trainingData.push(example);
    
    // Re-train the model if we have enough data
    if (this.trainingData.length > 10 && !this.isModelTrained) {
      this.trainModel();
    } else if (this.trainingData.length % 50 === 0 && this.isModelTrained) {
      // Re-train periodically as more data comes in
      this.trainModel();
    }
  }

  /**
   * Train the model using collected examples
   */
  public trainModel(): void {
    console.log(`Training model with ${this.trainingData.length} examples`);
    
    if (this.trainingData.length < 10) {
      console.log("Not enough training data");
      return;
    }
    
    // In a real implementation, we'd use a proper machine learning algorithm
    // For this example, we'll implement a simple gradient descent approach
    
    // Split data into training and validation sets
    const shuffle = [...this.trainingData].sort(() => Math.random() - 0.5);
    const splitIndex = Math.floor(shuffle.length * 0.8);
    const trainingSet = shuffle.slice(0, splitIndex);
    const validationSet = shuffle.slice(splitIndex);
    
    // Parameters for gradient descent
    const learningRate = 0.01;
    const epochs = 100;
    let bestAccuracy = this.evaluateModel(validationSet);
    let bestWeights = { ...this.weights };
    
    console.log(`Initial validation accuracy: ${bestAccuracy}`);
    
    // Gradient descent training loop
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Compute gradients
      const gradients = this.computeGradients(trainingSet);
      
      // Update weights
      for (const key of Object.keys(this.weights) as Array<keyof ModelWeights>) {
        this.weights[key] -= learningRate * gradients[key];
      }
      
      // Evaluate on validation set
      if (epoch % 10 === 0) {
        const accuracy = this.evaluateModel(validationSet);
        console.log(`Epoch ${epoch}, validation accuracy: ${accuracy}`);
        
        // Save best weights
        if (accuracy > bestAccuracy) {
          bestAccuracy = accuracy;
          bestWeights = { ...this.weights };
        }
      }
    }
    
    // Restore best weights
    this.weights = bestWeights;
    console.log(`Final validation accuracy: ${bestAccuracy}`);
    
    this.isModelTrained = true;
    
    // Update feature normalizers based on the full dataset
    this.updateNormalizers();
  }

  /**
   * Update normalizers based on the current dataset
   */
  private updateNormalizers(): void {
    const features = [
      'routeDeviation',
      'carrierExperience',
      'distanceToPickup',
      'deliveryDistance'
    ];
    
    for (const feature of features) {
      let min = Infinity;
      let max = -Infinity;
      
      for (const example of this.trainingData) {
        let value: number;
        
        switch (feature) {
          case 'routeDeviation':
            value = example.features.routeDeviationNormalized * 
                    (this.normalizers.get('routeDeviation')?.max || 10000);
            break;
          case 'carrierExperience':
            value = example.features.carrierExperienceNormalized * 
                    (this.normalizers.get('carrierExperience')?.max || 1000);
            break;
          case 'distanceToPickup':
            value = example.features.distanceToPickupNormalized * 
                    (this.normalizers.get('distanceToPickup')?.max || 50000);
            break;
          case 'deliveryDistance':
            value = example.features.pickupToDeliveryDistanceNormalized * 
                    (this.normalizers.get('deliveryDistance')?.max || 100000);
            break;
          default:
            continue;
        }
        
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      
      // Update normalizer with a bit of padding
      if (min !== Infinity && max !== -Infinity) {
        const padding = (max - min) * 0.1;
        this.normalizers.set(feature, {
          min: Math.max(0, min - padding),
          max: max + padding
        });
      }
    }
  }

  /**
   * Compute gradients for gradient descent
   */
  private computeGradients(examples: TrainingExample[]): ModelWeights {
    const gradients: ModelWeights = {
      routeDeviation: 0,
      timeWindowOverlap: 0,
      carrierRating: 0,
      packageWeight: 0,
      packageSize: 0,
      carrierUtilization: 0,
      carrierExperience: 0,
      distanceToPickup: 0,
      pickupToDeliveryDistance: 0,
      timeOfDay: 0,
      dayOfWeek: 0,
      specialRequirement: 0,
      intercept: 0
    };
    
    for (const example of examples) {
      // Predict score
      const prediction = this.predictMatchScore(example.features);
      const error = prediction - example.outcome;
      
      // Update gradients
      gradients.routeDeviation += error * (1 - example.features.routeDeviationNormalized);
      gradients.timeWindowOverlap += error * example.features.timeWindowOverlapPercentage;
      gradients.carrierRating += error * example.features.carrierRatingNormalized;
      gradients.packageWeight += error * (1 - example.features.packageWeightToCapacityRatio);
      gradients.packageSize += error * (1 - example.features.packageSizeToCapacityRatio);
      gradients.carrierUtilization += error * (1 - example.features.carrierUtilizationRatio);
      gradients.carrierExperience += error * example.features.carrierExperienceNormalized;
      gradients.distanceToPickup += error * (1 - example.features.distanceToPickupNormalized);
      gradients.pickupToDeliveryDistance += error * (1 - example.features.pickupToDeliveryDistanceNormalized);
      gradients.timeOfDay += error * example.features.timeOfDayNormalized;
      gradients.dayOfWeek += error * example.features.dayOfWeekNormalized;
      gradients.specialRequirement += error * example.features.isSpecialRequirement;
      gradients.intercept += error;
    }
    
    // Average gradients
    const n = examples.length;
    for (const key of Object.keys(gradients) as Array<keyof ModelWeights>) {
      gradients[key] /= n;
    }
    
    return gradients;
  }

  /**
   * Evaluate model on a dataset
   */
  private evaluateModel(examples: TrainingExample[]): number {
    if (examples.length === 0) {
      return 0;
    }
    
    let correctPredictions = 0;
    
    for (const example of examples) {
      const prediction = this.predictMatchScore(example.features);
      const predictedClass = prediction >= 0.5 ? 1 : 0;
      
      if (predictedClass === example.outcome) {
        correctPredictions++;
      }
    }
    
    return correctPredictions / examples.length;
  }

  /**
   * Score a potential match between a package and carrier
   */
  public scoreMatch(carrier: Carrier, pkg: Package): { score: number; estimatedArrival: Date } {
    // Extract features
    const features = this.extractFeatures(carrier, pkg);
    
    // Check if basic compatibility requirements are met
    if (
      features.timeWindowOverlapPercentage === 0 ||
      pkg.weight > carrier.maxWeight ||
      pkg.size > carrier.maxSize ||
      (pkg.requiresRefrigeration && !carrier.hasRefrigeration)
    ) {
      return {
        score: 0,
        estimatedArrival: new Date()
      };
    }
    
    // Predict match score using the model
    const score = this.predictMatchScore(features);
    
    // Calculate estimated arrival time
    const averageSpeed = 30; // km/h
    const distanceToPickup = this.calculateDistance(carrier.currentLocation, pkg.pickupLocation);
    const distanceToDelivery = this.calculateDistance(pkg.pickupLocation, pkg.deliveryLocation);
    const totalDistance = distanceToPickup + distanceToDelivery;
    
    // Calculate travel time in hours
    const travelTimeHours = totalDistance / 1000 / averageSpeed;
    
    // Estimated arrival time
    const estimatedArrival = new Date();
    estimatedArrival.setHours(estimatedArrival.getHours() + travelTimeHours);
    
    return {
      score,
      estimatedArrival
    };
  }

  /**
   * Get the current model weights
   */
  public getModelWeights(): ModelWeights {
    return { ...this.weights };
  }

  /**
   * Load a pre-trained model
   */
  public loadModel(weights: ModelWeights): void {
    this.weights = { ...weights };
    this.isModelTrained = true;
  }

  /**
   * Export training data for analysis
   */
  public exportTrainingData(): TrainingExample[] {
    return [...this.trainingData];
  }
}

/**
 * Find the best matches for a package among available carriers using the ML model
 */
export function findMatchesForPackage(
  model: MatchingModel,
  pkg: Package,
  availableCarriers: Carrier[],
  minScore: number = 0.6
): Match[] {
  // Score all potential matches
  const scoredMatches = availableCarriers.map(carrier => {
    const { score, estimatedArrival } = model.scoreMatch(carrier, pkg);
    
    return {
      carrierId: carrier.id,
      packageId: pkg.id,
      score,
      estimatedArrival
    };
  });
  
  // Filter out matches below the minimum score
  const qualifyingMatches = scoredMatches.filter(match => match.score >= minScore);
  
  // Sort by score (highest first)
  const sortedMatches = qualifyingMatches.sort((a, b) => b.score - a.score);
  
  // Convert to Match objects
  return sortedMatches.map(match => ({
    id: `${match.packageId}-${match.carrierId}`,
    packageId: match.packageId,
    carrierId: match.carrierId,
    score: match.score,
    routeDeviationMeters: 0, // This would be calculated and stored in a real implementation
    estimatedArrival: match.estimatedArrival,
    status: 'PROPOSED' as MatchStatus
  }));
}

/**
 * Find the best packages for a carrier to deliver using the ML model
 */
export function findMatchesForCarrier(
  model: MatchingModel,
  carrier: Carrier,
  availablePackages: Package[],
  minScore: number = 0.6
): Match[] {
  // Score all potential matches
  const scoredMatches = availablePackages.map(pkg => {
    const { score, estimatedArrival } = model.scoreMatch(carrier, pkg);
    
    return {
      carrierId: carrier.id,
      packageId: pkg.id,
      score,
      estimatedArrival
    };
  });
  
  // Filter out matches below the minimum score
  const qualifyingMatches = scoredMatches.filter(match => match.score >= minScore);
  
  // Sort by score (highest first)
  const sortedMatches = qualifyingMatches.sort((a, b) => b.score - a.score);
  
  // Convert to Match objects
  return sortedMatches.map(match => ({
    id: `${match.packageId}-${match.carrierId}`,
    packageId: match.packageId,
    carrierId: match.carrierId,
    score: match.score,
    routeDeviationMeters: 0, // This would be calculated and stored in a real implementation
    estimatedArrival: match.estimatedArrival,
    status: 'PROPOSED' as MatchStatus
  }));
}

/**
 * Batch matching algorithm to optimize matches between packages and carriers using ML model
 */
export function batchMatchingAlgorithm(
  model: MatchingModel,
  packages: Package[],
  carriers: Carrier[]
): Match[] {
  // Create a matrix of all possible match scores
  const allScores: {
    packageId: string;
    carrierId: string;
    score: number;
    estimatedArrival: Date;
  }[] = [];
  
  packages.forEach(pkg => {
    carriers.forEach(carrier => {
      const { score, estimatedArrival } = model.scoreMatch(carrier, pkg);
      
      if (score > 0) {
        allScores.push({
          packageId: pkg.id,
          carrierId: carrier.id,
          score,
          estimatedArrival
        });
      }
    });
  });
  
  // Sort all scores by score (highest first)
  allScores.sort((a, b) => b.score - a.score);
  
  // Keep track of assigned packages and carriers
  const assignedPackages = new Set<string>();
  const assignedCarriers = new Map<string, number>(); // carrier ID -> number of assignments
  
  // Final matches
  const matches: Match[] = [];
  
  // Iterate through scores and assign matches
  for (const score of allScores) {
    // Skip if package is already assigned
    if (assignedPackages.has(score.packageId)) {
      continue;
    }
    
    // Get the carrier
    const carrier = carriers.find(c => c.id === score.carrierId);
    if (!carrier) continue;
    
    // Skip if carrier has reached max capacity
    const currentAssignments = assignedCarriers.get(score.carrierId) || 0;
    if (currentAssignments >= carrier.maxPackages) {
      continue;
    }
    
    // Create the match
    matches.push({
      id: `${score.packageId}-${score.carrierId}`,
      packageId: score.packageId,
      carrierId: score.carrierId,
      score: score.score,
      routeDeviationMeters: 0, // This would be calculated in a real implementation
      estimatedArrival: score.estimatedArrival,
      status: 'PROPOSED'
    });
    
    // Mark package as assigned
    assignedPackages.add(score.packageId);
    
    // Update carrier assignment count
    assignedCarriers.set(score.carrierId, currentAssignments + 1);
  }
  
  return matches;
}

// Export a singleton instance of the ML model
export const matchingModel = new MatchingModel();