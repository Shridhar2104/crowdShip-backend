// src/models/ml/mlModels.ts
import mongoose, { Document, Model, Schema } from 'mongoose';
import { logger } from '../../utils/logger';

// ========== INTERFACES ==========

// Match Score Interface
export interface IMatchScore extends Document {
  carrierId: string;
  packageId: string;
  matchScore: number;
  compensation: number;
  routeDeviation: {
    distance: number;
    time: number;
  };
  createdAt: Date;
  expiredAt: Date;
}

// Package Dimensions Interface
export interface IPackageDimensions {
  length: number;
  width: number;
  height: number;
  weight: number;
}

// Package Interface
export interface IPackage extends Document {
  packageId: string;
  pickupCoordinates: [number, number];
  deliveryCoordinates: [number, number];
  pickupWindow: [string, string];
  deliveryWindow: [string, string];
  dimensions: IPackageDimensions;
  urgency: 'low' | 'medium' | 'high';
  status: string;
  matched: boolean;
  matchedAt?: Date;
  lastFirestoreSync: Date;
}

// Vehicle Capacity Interface
export interface IVehicleCapacity {
  length: number;
  width: number;
  height: number;
  weightLimit: number;
}

// Carrier Interface
export interface ICarrier extends Document {
  carrierId: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
  };
  routeCoordinates: [number, number][];
  schedule: {
    startTime: string;
    endTime: string;
  };
  vehicleCapacity: IVehicleCapacity;
  rating: number;
  onTimeRate: number;
  completedDeliveries: string[];
  vehicleType: string;
  vehicleSize?: string;
  active: boolean;
  lastFirestoreSync: Date;
}

// Match History Interface
export interface IMatchHistory extends Document {
  matchId: string;
  packageId: string;
  carrierId: string;
  score: number;
  status: 'pending' | 'accepted' | 'rejected' | 'picked_up' | 'delivered' | 'completed' | 'canceled';
  detourDistance?: number;
  detourTime?: number;
  estimatedPickupTime?: Date;
  estimatedDeliveryTime?: Date;
  actualPickupTime?: Date;
  actualDeliveryTime?: Date;
  carrierPayoutAmount?: number;
  platformFeeAmount?: number;
  success?: boolean;
  features?: Record<string, any>;
  usedForTraining: boolean;
  lastFirestoreSync: Date;
}

// Feedback Interface
export interface IFeedback extends Document {
  matchId: string;
  success: boolean;
  feedback?: string;
  rating?: number;
  usedForTraining: boolean;
}

// Model Performance Interface
export interface IModelPerformance extends Document {
  modelVersion: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainingSize?: number;
  validationSize?: number;
  confusionMatrix?: Record<string, any>;
  trainedAt: Date;
}

// Training Run Interface
export interface ITrainingRun extends Document {
  startTime: Date;
  endTime?: Date;
  modelVersion?: string;
  datasetSize?: number;
  hyperparameters?: Record<string, any>;
  status: 'running' | 'completed' | 'failed';
  metrics?: Record<string, any>;
  logs: Array<{
    message: string;
    level: string;
    timestamp: Date;
  }>;
}

// Auto-Match Batch Interface
export interface IAutoMatchBatch extends Document {
  batchId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  packagesProcessed: number;
  matchesCreated: number;
  unableToMatch: string[];
  logs: Array<{
    message: string;
    level: string;
    timestamp: Date;
  }>;
}

// ========== SCHEMAS ==========

// Match Score Schema (for storing carrier-package match predictions)
const matchScoreSchema = new Schema({
  carrierId: { type: String, required: true, index: true },
  packageId: { type: String, required: true, index: true },
  matchScore: { type: Number, required: true },
  compensation: { type: Number, required: true },
  routeDeviation: {
    distance: { type: Number, required: true },
    time: { type: Number, required: true }
  },
  createdAt: { type: Date, default: Date.now },
  expiredAt: { type: Date, default: () => new Date(Date.now() + 4 * 60 * 60 * 1000) } // 4 hours from now
}, { timestamps: true });


// Package dimensions schema
const packageDimensionsSchema = new Schema<IPackageDimensions>({
  length: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  weight: { type: Number, required: true }
});

// Package Schema (synchronized from Firestore)
const packageSchema = new Schema<IPackage>({
  packageId: { type: String, required: true, unique: true },
  pickupCoordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v: number[]) {
        return v.length === 2;
      },
      message: 'Pickup coordinates must be [latitude, longitude]'
    }
  },
  deliveryCoordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v: number[]) {
        return v.length === 2;
      },
      message: 'Delivery coordinates must be [latitude, longitude]'
    }
  },
  pickupWindow: { type: [String], required: true },
  deliveryWindow: { type: [String], required: true },
  dimensions: { type: packageDimensionsSchema, required: true },
  urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status: { type: String, default: 'ready_for_pickup' },
  matched: { type: Boolean, default: false },
  matchedAt: { type: Date },
  lastFirestoreSync: { type: Date, default: Date.now }
}, { timestamps: true });

// Vehicle capacity schema
const vehicleCapacitySchema = new Schema<IVehicleCapacity>({
  length: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  weightLimit: { type: Number, required: true }
});

// Carrier Schema (synchronized from Firestore)
const carrierSchema = new Schema<ICarrier>({
  carrierId: { type: String, required: true, unique: true },
  lastLocation: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  routeCoordinates: {
    type: [[Number]],
    validate: {
      validator: function(v: number[][]) {
        return v.every(coord => coord.length === 2);
      },
      message: 'Route coordinates must be array of [latitude, longitude] pairs'
    }
  },
  schedule: {
    startTime: { type: String },
    endTime: { type: String }
  },
  vehicleCapacity: { type: vehicleCapacitySchema },
  rating: { type: Number, default: 0 },
  onTimeRate: { type: Number, default: 0 },
  completedDeliveries: { type: [String], default: [] },
  vehicleType: { type: String },
  vehicleSize: { type: String },
  active: { type: Boolean, default: true },
  lastFirestoreSync: { type: Date, default: Date.now }
}, { timestamps: true });

// Match History Schema (for model training)
const matchHistorySchema = new Schema<IMatchHistory>({
  matchId: { type: String, required: true, unique: true },
  packageId: { type: String, required: true, index: true },
  carrierId: { type: String, required: true, index: true },
  score: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'rejected', 'picked_up', 'delivered', 'completed', 'canceled'], 
    required: true 
  },
  detourDistance: { type: Number },
  detourTime: { type: Number },
  estimatedPickupTime: { type: Date },
  estimatedDeliveryTime: { type: Date },
  actualPickupTime: { type: Date },
  actualDeliveryTime: { type: Date },
  carrierPayoutAmount: { type: Number },
  platformFeeAmount: { type: Number },
  success: { type: Boolean }, // Used for model training
  features: { type: Schema.Types.Mixed }, // Store extracted features for model analysis
  usedForTraining: { type: Boolean, default: false },
  lastFirestoreSync: { type: Date, default: Date.now }
}, { timestamps: true });

// Feedback Schema
const feedbackSchema = new Schema<IFeedback>({
  matchId: { type: String, required: true, unique: true },
  success: { type: Boolean, required: true },
  feedback: { type: String },
  rating: { type: Number, min: 1, max: 5 },
  usedForTraining: { type: Boolean, default: false }
}, { timestamps: true });

// Model Performance Schema
const modelPerformanceSchema = new Schema<IModelPerformance>({
  modelVersion: { type: String, required: true },
  accuracy: { type: Number },
  precision: { type: Number },
  recall: { type: Number },
  f1Score: { type: Number },
  trainingSize: { type: Number },
  validationSize: { type: Number },
  confusionMatrix: { type: Schema.Types.Mixed },
  trainedAt: { type: Date, default: Date.now }
});

// Model Training Run Schema
const trainingRunSchema = new Schema<ITrainingRun>({
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  modelVersion: { type: String },
  datasetSize: { type: Number },
  hyperparameters: { type: Schema.Types.Mixed },
  status: { 
    type: String, 
    enum: ['running', 'completed', 'failed'],
    default: 'running'
  },
  metrics: { type: Schema.Types.Mixed },
  logs: [{ 
    message: String, 
    level: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Auto-Match Batch Run Schema
const autoMatchBatchSchema = new Schema<IAutoMatchBatch>({
  batchId: { type: String, required: true, unique: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: { 
    type: String, 
    enum: ['running', 'completed', 'failed'],
    default: 'running'
  },
  packagesProcessed: { type: Number, default: 0 },
  matchesCreated: { type: Number, default: 0 },
  unableToMatch: { type: [String], default: [] }, // Package IDs that couldn't be matched
  logs: [{ 
    message: String, 
    level: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

// ========== MODELS ==========

// Create models conditionally to handle case when MongoDB isn't connected
export const createModels = () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - return null models
      logger.warn('MongoDB not connected - ML models may not work correctly');
      return {
        MatchScore: null,
        Package: null,
        Carrier: null,
        MatchHistory: null,
        Feedback: null,
        ModelPerformance: null,
        TrainingRun: null,
        AutoMatchBatch: null
      };
    }
    
    // MongoDB is connected - create and export models
    return {
      MatchScore: mongoose.models.MatchScore || mongoose.model<IMatchScore>('MatchScore', matchScoreSchema),
      Package: mongoose.models.Package || mongoose.model<IPackage>('Package', packageSchema),
      Carrier: mongoose.models.Carrier || mongoose.model<ICarrier>('Carrier', carrierSchema),
      MatchHistory: mongoose.models.MatchHistory || mongoose.model<IMatchHistory>('MatchHistory', matchHistorySchema),
      Feedback: mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', feedbackSchema),
      ModelPerformance: mongoose.models.ModelPerformance || mongoose.model<IModelPerformance>('ModelPerformance', modelPerformanceSchema),
      TrainingRun: mongoose.models.TrainingRun || mongoose.model<ITrainingRun>('TrainingRun', trainingRunSchema),
      AutoMatchBatch: mongoose.models.AutoMatchBatch || mongoose.model<IAutoMatchBatch>('AutoMatchBatch', autoMatchBatchSchema)
    };
  } catch (error) {
    logger.error('Error creating MongoDB models:', error);
    // Return null models in case of error
    return {
      MatchScore: null,
      Package: null,
      Carrier: null,
      MatchHistory: null,
      Feedback: null,
      ModelPerformance: null,
      TrainingRun: null,
      AutoMatchBatch: null
    };
  }
};

// Create models and export them
const models = createModels();

export const MatchScore = models.MatchScore as Model<IMatchScore>;
export const Package = models.Package as Model<IPackage>;
export const Carrier = models.Carrier as Model<ICarrier>;
export const MatchHistory = models.MatchHistory as Model<IMatchHistory>;
export const Feedback = models.Feedback as Model<IFeedback>;
export const ModelPerformance = models.ModelPerformance as Model<IModelPerformance>;
export const TrainingRun = models.TrainingRun as Model<ITrainingRun>;
export const AutoMatchBatch = models.AutoMatchBatch as Model<IAutoMatchBatch>;

// Helper function for distance calculation
export const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

// Interface for training data
export interface TrainingDataItem {
  package: {
    id: string;
    pickupCoordinates: [number, number];
    deliveryCoordinates: [number, number];
    pickupWindow: [string, string];
    deliveryWindow: [string, string];
    dimensions: IPackageDimensions;
    urgency: string;
  };
  carrier: {
    id: string;
    routeCoordinates: [number, number][];
    schedule: {
      startTime: string;
      endTime: string;
    };
    vehicleCapacity: IVehicleCapacity;
    rating: number;
    onTimeRate: number;
    completedDeliveries: string[];
    vehicleType: string;
    vehicleSize?: string;
  };
  success: number;
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Record match feedback
 */
export const recordFeedback = async (matchId: string, success: boolean, feedback: string, rating?: number): Promise<IFeedback | null> => {
  try {
    if (!Feedback) {
      logger.error('MongoDB Feedback model not available');
      return null;
    }
    
    const feedbackDoc = {
      matchId,
      success,
      feedback,
      rating,
      usedForTraining: false
    };

    // Update or create
    const result = await Feedback.findOneAndUpdate(
      { matchId },
      feedbackDoc,
      { upsert: true, new: true }
    );

    return result;
  } catch (error) {
    logger.error(`Error recording feedback for match ${matchId}:`, error);
    return null;
  }
};

/**
 * Record model training run
 */
export const startTrainingRun = async (hyperparameters: Record<string, any>): Promise<ITrainingRun | null> => {
  try {
    if (!TrainingRun) {
      logger.error('MongoDB TrainingRun model not available');
      return null;
    }
    
    const run = new TrainingRun({
      startTime: new Date(),
      hyperparameters,
      status: 'running'
    });

    return await run.save();
  } catch (error) {
    logger.error('Error starting training run:', error);
    return null;
  }
};

/**
 * Complete model training run
 */
export const completeTrainingRun = async (runId: string, modelVersion: string, metrics: Record<string, any>, status: 'completed' | 'failed'): Promise<ITrainingRun | null> => {
  try {
    if (!TrainingRun) {
      logger.error('MongoDB TrainingRun model not available');
      return null;
    }
    
    return await TrainingRun.findByIdAndUpdate(
      runId,
      {
        endTime: new Date(),
        modelVersion,
        metrics,
        status
      },
      { new: true }
    );
  } catch (error) {
    logger.error(`Error completing training run ${runId}:`, error);
    return null;
  }
};

/**
 * Save model performance metrics
 */
export const saveModelPerformance = async (modelVersion: string, metrics: {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  trainingSize?: number;
  validationSize?: number;
  confusionMatrix?: Record<string, any>;
}): Promise<IModelPerformance | null> => {
  try {
    if (!ModelPerformance) {
      logger.error('MongoDB ModelPerformance model not available');
      return null;
    }
    
    const performance = new ModelPerformance({
      modelVersion,
      accuracy: metrics.accuracy,
      precision: metrics.precision,
      recall: metrics.recall,
      f1Score: metrics.f1Score,
      trainingSize: metrics.trainingSize,
      validationSize: metrics.validationSize,
      confusionMatrix: metrics.confusionMatrix,
      trainedAt: new Date()
    });

    return await performance.save();
  } catch (error) {
    logger.error(`Error saving model performance for ${modelVersion}:`, error);
    return null;
  }
};

/**
 * Get training data for model
 */
export const getTrainingData = async (limit: number = 1000): Promise<TrainingDataItem[]> => {
  try {
    if (!MatchHistory || !Package || !Carrier) {
      logger.error('MongoDB models not available for getTrainingData');
      return [];
    }
    
    // Get completed matches with feedback
    const matches = await MatchHistory.find({
      status: { $in: ['completed', 'delivered', 'rejected', 'canceled'] },
      usedForTraining: false
    })
    .sort({ createdAt: -1 })
    .limit(limit);

    if (matches.length === 0) {
      return [];
    }

    const trainingData: TrainingDataItem[] = [];

    for (const match of matches) {
      // Get package and carrier data
      const package1 = await Package.findOne({ packageId: match.packageId });
      const carrier = await Carrier.findOne({ carrierId: match.carrierId });

      if (!package1 || !carrier) {
        continue;
      }

      // Mark as used for training
      await MatchHistory.findByIdAndUpdate(match._id, { usedForTraining: true });

      // Add to training data
      trainingData.push({
        package: {
          id: package1.packageId,
          pickupCoordinates: package1.pickupCoordinates as [number, number],
          deliveryCoordinates: package1.deliveryCoordinates as [number, number],
          pickupWindow: package1.pickupWindow as [string, string],
          deliveryWindow: package1.deliveryWindow as [string, string],
          dimensions: package1.dimensions,
          urgency: package1.urgency
        },
        carrier: {
          id: carrier.carrierId,
          routeCoordinates: carrier.routeCoordinates as [number, number][],
          schedule: carrier.schedule,
          vehicleCapacity: carrier.vehicleCapacity,
          rating: carrier.rating,
          onTimeRate: carrier.onTimeRate,
          completedDeliveries: carrier.completedDeliveries,
          vehicleType: carrier.vehicleType,
          vehicleSize: carrier.vehicleSize
        },
        success: match.success ? 1 : 0
      });
    }

    return trainingData;
  } catch (error) {
    logger.error('Error getting training data:', error);
    return [];
  }
};

/**
 * Store match scores from prediction
 */
export const storeMatchScores = async (scores: {
  carrierId: string;
  packageId: string;
  matchScore: number;
  compensation: number;
  routeDeviation: {
    distance: number;
    time: number;
  };
}[]): Promise<IMatchScore[] | null> => {
  try {
    if (!MatchScore) {
      logger.error('MongoDB MatchScore model not available');
      return null;
    }
    
    const results: IMatchScore[] = [];

    for (const score of scores) {
      const matchScore = new MatchScore({
        carrierId: score.carrierId,
        packageId: score.packageId,
        matchScore: score.matchScore,
        compensation: score.compensation,
        routeDeviation: score.routeDeviation
      });

      results.push(await matchScore.save());
    }

    return results;
  } catch (error) {
    logger.error('Error storing match scores:', error);
    return null;
  }
};
// Continuing from previous file...

/**
 * Find optimal carriers using MongoDB
 */
 export const findOptimalCarriers = async (packageId: string, radius: number = 10, maxCarriers: number = 5): Promise<any[]> => {
    try {
      if (!Package || !Carrier || !MatchScore) {
        logger.error('MongoDB models not available for findOptimalCarriers');
        return [];
      }
      
      // Get package
      const package2 = await Package.findOne({ packageId });
      
      if (!package2) {
        throw new Error(`Package ${packageId} not found in MongoDB`);
      }
  
      // Find carriers within radius of pickup
      const pickupLat = package2.pickupCoordinates[0];
      const pickupLng = package2.pickupCoordinates[1];
  
      // Use MongoDB's geospatial queries if you have GeoJSON coordinates
      // For simple distance calculation, we'll do it manually
      const carriers = await Carrier.find({ active: true });
      
      const nearbyCarriers = carriers.filter((carrier) => {
        if (!carrier.lastLocation || 
          typeof carrier.lastLocation.latitude !== 'number' || 
          typeof carrier.lastLocation.longitude !== 'number') {
          return false;
        }
        
        // Simple distance calculation
        const carrierLat = carrier.lastLocation.latitude;
        const carrierLng = carrier.lastLocation.longitude;
        
        // Convert to radians for more accurate distance calculation
        const latDistance = deg2rad(pickupLat - carrierLat);
        const lngDistance = deg2rad(pickupLng - carrierLng);
        
        const a = 
          Math.sin(latDistance/2) * Math.sin(latDistance/2) +
          Math.cos(deg2rad(carrierLat)) * Math.cos(deg2rad(pickupLat)) * 
          Math.sin(lngDistance/2) * Math.sin(lngDistance/2); 
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = 6371 * c; // Earth radius in km
        
        return distance <= radius;
      });
  
      if (nearbyCarriers.length === 0) {
        return [];
      }
  
      // Get current match scores if they exist
      const scores = await MatchScore.find({
        packageId,
        carrierId: { $in: nearbyCarriers.map(c => c.carrierId) },
        expiredAt: { $gt: new Date() }
      }).sort({ matchScore: -1 }).limit(maxCarriers);
  
      // If we already have scores, return them
      if (scores.length > 0) {
        return scores;
      }
  
      // We need to calculate match scores for these carriers
      // This would typically call your prediction service
      // For now we'll return the carriers with placeholder scores
      return nearbyCarriers.slice(0, maxCarriers).map(carrier => ({
        carrierId: carrier.carrierId,
        packageId,
        matchScore: 0.5, // Placeholder
        compensation: 50, // Placeholder
        routeDeviation: {
          distance: 5,
          time: 15
        }
      }));
    } catch (error) {
      logger.error(`Error finding optimal carriers for package ${packageId}:`, error);
      return [];
    }
  };
  
  /**
   * Sync a package from Firestore to MongoDB
   */
  export const syncPackage = async (packageId: string, packageData: any): Promise<IPackage | null> => {
    try {
      if (!Package) {
        logger.error('MongoDB Package model not available');
        return null;
      }
      
      // Prepare package data
      const packageDoc = {
        packageId,
        pickupCoordinates: [
          packageData.pickupLocation.latitude,
          packageData.pickupLocation.longitude
        ] as [number, number],
        deliveryCoordinates: [
          packageData.deliveryLocation.latitude,
          packageData.deliveryLocation.longitude
        ] as [number, number],
        pickupWindow: packageData.pickupWindow || ['08:00', '18:00'],
        deliveryWindow: packageData.deliveryWindow || ['08:00', '18:00'],
        dimensions: packageData.dimensions || {
          length: 10,
          width: 10,
          height: 10,
          weight: packageData.packageWeight || 1
        },
        urgency: packageData.urgency || 'medium',
        status: packageData.status,
        matched: packageData.matched || false,
        matchedAt: packageData.matchedAt ? new Date(packageData.matchedAt.toDate()) : undefined,
        lastFirestoreSync: new Date()
      };
  
      // Update or create
      const result = await Package.findOneAndUpdate(
        { packageId },
        packageDoc,
        { upsert: true, new: true }
      );
  
      return result;
    } catch (error) {
      logger.error(`Error syncing package ${packageId} to MongoDB:`, error);
      return null;
    }
  };
  
  /**
   * Sync a carrier from Firestore to MongoDB
   */
  export const syncCarrier = async (carrierId: string, carrierData: any): Promise<ICarrier | null> => {
    try {
      if (!Carrier) {
        logger.error('MongoDB Carrier model not available');
        return null;
      }
      
      // Prepare carrier data
      const carrierDoc = {
        carrierId,
        lastLocation: carrierData.lastLocation,
        routeCoordinates: carrierData.routeCoordinates || 
          (carrierData.lastLocation ? [[carrierData.lastLocation.latitude, carrierData.lastLocation.longitude]] : []),
        schedule: carrierData.schedule || {
          startTime: '08:00',
          endTime: '18:00'
        },
        vehicleCapacity: carrierData.vehicleCapacity || {
          length: 100,
          width: 100,
          height: 100,
          weightLimit: 50
        },
        rating: carrierData.rating || 0,
        onTimeRate: carrierData.onTimeRate || 0,
        completedDeliveries: carrierData.completedDeliveries || [],
        vehicleType: carrierData.vehicleType || 'car',
        vehicleSize: carrierData.vehicleSize,
        active: carrierData.active !== undefined ? carrierData.active : true,
        lastFirestoreSync: new Date()
      };
  
      // Update or create
      const result = await Carrier.findOneAndUpdate(
        { carrierId },
        carrierDoc,
        { upsert: true, new: true }
      );
  
      return result;
    } catch (error) {
      logger.error(`Error syncing carrier ${carrierId} to MongoDB:`, error);
      return null;
    }
  };
  
  /**
   * Sync a match from Firestore to MongoDB for training purposes
   */
  export const syncMatchHistory = async (matchId: string, matchData: any): Promise<IMatchHistory | null> => {
    try {
      if (!MatchHistory) {
        logger.error('MongoDB MatchHistory model not available');
        return null;
      }
      
      // Only sync completed or rejected matches for model training
      if (matchData.status !== 'completed' && matchData.status !== 'rejected' && 
          matchData.status !== 'delivered' && matchData.status !== 'canceled') {
        return null;
      }
  
      // Determine success (for model training)
      const success = matchData.status === 'completed' || matchData.status === 'delivered';
  
      // Prepare match data
      const matchDoc = {
        matchId,
        packageId: matchData.packageId,
        carrierId: matchData.carrierId,
        score: matchData.score,
        status: matchData.status,
        detourDistance: matchData.detourDistance,
        detourTime: matchData.detourTime,
        estimatedPickupTime: matchData.estimatedPickupTime ? new Date(matchData.estimatedPickupTime.toDate()) : undefined,
        estimatedDeliveryTime: matchData.estimatedDeliveryTime ? new Date(matchData.estimatedDeliveryTime.toDate()) : undefined,
        actualPickupTime: matchData.actualPickupTime ? new Date(matchData.actualPickupTime.toDate()) : undefined,
        actualDeliveryTime: matchData.actualDeliveryTime ? new Date(matchData.actualDeliveryTime.toDate()) : undefined,
        carrierPayoutAmount: matchData.carrierPayoutAmount,
        platformFeeAmount: matchData.platformFeeAmount,
        success,
        lastFirestoreSync: new Date()
      };
  
      // Update or create
      const result = await MatchHistory.findOneAndUpdate(
        { matchId },
        matchDoc,
        { upsert: true, new: true }
      );
  
      return result;
    } catch (error) {
      logger.error(`Error syncing match history ${matchId} to MongoDB:`, error);
      return null;
    }
  };
  
  /**
   * Start auto-match batch
   */
  export const startAutoMatchBatch = async (): Promise<IAutoMatchBatch | null> => {
    try {
      if (!AutoMatchBatch) {
        logger.error('MongoDB AutoMatchBatch model not available');
        return null;
      }
      
      const batchId = 'batch_' + Date.now().toString();
      const batch = new AutoMatchBatch({
        batchId,
        startTime: new Date(),
        status: 'running',
        packagesProcessed: 0,
        matchesCreated: 0,
        unableToMatch: []
      });
  
      return await batch.save();
    } catch (error) {
      logger.error('Error starting auto-match batch:', error);
      return null;
    }
  };
  
  /**
   * Update auto-match batch
   */
  export const updateAutoMatchBatch = async (batchId: string, updates: Partial<IAutoMatchBatch>): Promise<IAutoMatchBatch | null> => {
    try {
      if (!AutoMatchBatch) {
        logger.error('MongoDB AutoMatchBatch model not available');
        return null;
      }
      
      return await AutoMatchBatch.findOneAndUpdate(
        { batchId },
        updates,
        { new: true }
      );
    } catch (error) {
      logger.error(`Error updating auto-match batch ${batchId}:`, error);
      return null;
    }
  };
  
  /**
   * Complete auto-match batch
   */
  export const completeAutoMatchBatch = async (
    batchId: string, 
    packagesProcessed: number, 
    matchesCreated: number, 
    unableToMatch: string[], 
    status: 'completed' | 'failed'
  ): Promise<IAutoMatchBatch | null> => {
    try {
      if (!AutoMatchBatch) {
        logger.error('MongoDB AutoMatchBatch model not available');
        return null;
      }
      
      return await AutoMatchBatch.findOneAndUpdate(
        { batchId },
        {
          endTime: new Date(),
          packagesProcessed,
          matchesCreated,
          unableToMatch,
          status
        },
        { new: true }
      );
    } catch (error) {
      logger.error(`Error completing auto-match batch ${batchId}:`, error);
      return null;
    }
  };
  
  // Export all functions
  export default {
    MatchScore,
    Package,
    Carrier,
    MatchHistory,
    Feedback,
    ModelPerformance,
    TrainingRun,
    AutoMatchBatch,
    recordFeedback,
    startTrainingRun,
    completeTrainingRun,
    saveModelPerformance,
    getTrainingData,
    storeMatchScores,
    findOptimalCarriers,
    syncPackage,
    syncCarrier,
    syncMatchHistory,
    startAutoMatchBatch,
    updateAutoMatchBatch,
    completeAutoMatchBatch,
    deg2rad
  };