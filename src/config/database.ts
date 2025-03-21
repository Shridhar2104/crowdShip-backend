import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { config } from './index';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';
// At the top of your main file (before any other imports)
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') }); // Adjust path as needed

import mongoose, { Document, Model, Schema } from 'mongoose';

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

// MongoDB connection configuration
export const initializeMongoDB = async (): Promise<mongoose.Connection> => {
  try {
    // MongoDB connection URI from environment variables
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ml_matching';
    
    // MongoDB connection options
    const options: mongoose.ConnectOptions = {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, options);
    
    const db = mongoose.connection;
    
    db.on('error', (error: any) => {
      logger.error('MongoDB connection error:', error);
    });
    
    db.once('open', () => {
      logger.info('MongoDB connection established successfully');
    });
    
    db.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        logger.error('Error during MongoDB disconnect:', err);
        process.exit(1);
      }
    });
    
    return db;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

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

export const MatchScore: Model<IMatchScore> = mongoose.model<IMatchScore>('MatchScore', matchScoreSchema);
export const Package: Model<IPackage> = mongoose.model<IPackage>('Package', packageSchema);
export const Carrier: Model<ICarrier> = mongoose.model<ICarrier>('Carrier', carrierSchema);
export const MatchHistory: Model<IMatchHistory> = mongoose.model<IMatchHistory>('MatchHistory', matchHistorySchema);
export const Feedback: Model<IFeedback> = mongoose.model<IFeedback>('Feedback', feedbackSchema);
export const ModelPerformance: Model<IModelPerformance> = mongoose.model<IModelPerformance>('ModelPerformance', modelPerformanceSchema);
export const TrainingRun: Model<ITrainingRun> = mongoose.model<ITrainingRun>('TrainingRun', trainingRunSchema);
export const AutoMatchBatch: Model<IAutoMatchBatch> = mongoose.model<IAutoMatchBatch>('AutoMatchBatch', autoMatchBatchSchema);

// ========== UTILITY FUNCTIONS ==========

/**
 * Sync a package from Firestore to MongoDB
 */
export const syncPackage = async (packageId: string, packageData: any): Promise<IPackage> => {
  try {
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
    throw error;
  }
};

/**
 * Sync a carrier from Firestore to MongoDB
 */
export const syncCarrier = async (carrierId: string, carrierData: any): Promise<ICarrier> => {
  try {
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
    throw error;
  }
};

/**
 * Sync a match from Firestore to MongoDB for training purposes
 */
export const syncMatchHistory = async (matchId: string, matchData: any): Promise<IMatchHistory | null> => {
  try {
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
    throw error;
  }
};

/**
 * Record match feedback
 */
export const recordFeedback = async (matchId: string, success: boolean, feedback: string, rating?: number): Promise<IFeedback> => {
  try {
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
    throw error;
  }
};

/**
 * Record model training run
 */
export const startTrainingRun = async (hyperparameters: Record<string, any>): Promise<ITrainingRun> => {
  try {
    const run = new TrainingRun({
      startTime: new Date(),
      hyperparameters,
      status: 'running'
    });

    return await run.save();
  } catch (error) {
    logger.error('Error starting training run:', error);
    throw error;
  }
};

/**
 * Complete model training run
 */
export const completeTrainingRun = async (runId: string, modelVersion: string, metrics: Record<string, any>, status: 'completed' | 'failed'): Promise<ITrainingRun | null> => {
  try {
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
    throw error;
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
}): Promise<IModelPerformance> => {
  try {
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
    throw error;
  }
};

/**
 * Start auto-match batch
 */
export const startAutoMatchBatch = async (): Promise<IAutoMatchBatch> => {
  try {
    const batchId = 'batch_' + Date.now().toString();
    const batch = new AutoMatchBatch({
      batchId,
      startTime: new Date(),
      status: 'running'
    });

    return await batch.save();
  } catch (error) {
    logger.error('Error starting auto-match batch:', error);
    throw error;
  }
};

/**
 * Update auto-match batch
 */
export const updateAutoMatchBatch = async (batchId: string, updates: Partial<IAutoMatchBatch>): Promise<IAutoMatchBatch | null> => {
  try {
    return await AutoMatchBatch.findOneAndUpdate(
      { batchId },
      updates,
      { new: true }
    );
  } catch (error) {
    logger.error(`Error updating auto-match batch ${batchId}:`, error);
    throw error;
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
    throw error;
  }
};

// Interface for training data
interface TrainingDataItem {
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

/**
 * Get training data for model
 */
export const getTrainingData = async (limit: number = 1000): Promise<TrainingDataItem[]> => {
  try {
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
    throw error;
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
}[]): Promise<IMatchScore[]> => {
  try {
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
    throw error;
  }
};

/**
 * Find optimal carriers using MongoDB
 */
export const findOptimalCarriers = async (packageId: string, radius: number = 10, maxCarriers: number = 5): Promise<any[]> => {
  try {
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
      
      // Simple distance calculation (pythagorean approximation)
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
      carrierId: { $in: nearbyCarriers.map((c: { carrierId: any; }) => c.carrierId) },
      expiredAt: { $gt: new Date() }
    }).sort({ matchScore: -1 }).limit(maxCarriers);

    // If we already have scores, return them
    if (scores.length > 0) {
      return scores;
    }

    // We need to calculate match scores for these carriers
    // This would typically call your prediction service
    // For now we'll return the carriers with placeholder scores
    return nearbyCarriers.slice(0, maxCarriers).map((carrier: { carrierId: any; }) => ({
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
    throw error;
  }
};

// Helper function for distance calculation
const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

// MongoDB connection
export const mongoConnection = initializeMongoDB();

// Export all
export default {
  initializeMongoDB,
  MatchScore,
  Package,
  Carrier,
  MatchHistory,
  Feedback,
  ModelPerformance,
  TrainingRun,
  AutoMatchBatch,
  syncPackage,
  syncCarrier,
  syncMatchHistory,
  recordFeedback,
  startTrainingRun,
  completeTrainingRun,
  saveModelPerformance,
  startAutoMatchBatch,
  updateAutoMatchBatch,
  completeAutoMatchBatch,
  getTrainingData,
  storeMatchScores,
  findOptimalCarriers
}
const initializeFirebaseAdmin = () => {
  try {
    let serviceAccount;
    
    // Check if we have the base64 encoded service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      // Decode the base64 string to a JSON string
      const decodedServiceAccount = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        'base64'
      ).toString('utf8');
      
      // Parse the JSON string to an object
      serviceAccount = JSON.parse(decodedServiceAccount);
    } else {
      // Fallback to file for local development
      try {
        const serviceAccountPath = path.resolve(process.cwd(), 'firebase-key.json');
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        logger.info('Firebase Admin initialized using local service account file');
      } catch (fileError) {
        logger.error('Failed to read local firebase-key.json:', fileError);
        throw new Error('Firebase service account not found in environment variables or local file');
      }
    }
    
    // Initialize Firebase with the service account
    const app = initializeApp({
      credential: cert(serviceAccount),
    });
    
    logger.info('Firebase Admin initialized successfully');
    return app;
  } catch (error: any) {
    // Handle errors
    if (error.code === 'app/duplicate-app') {
      logger.warn('Firebase app already initialized');
      return initializeApp();
    }
    
    logger.error('Firebase initialization error:', error);
    throw error;
  }
};


// Firebase app instance
export const firebaseApp = initializeFirebaseAdmin();

// Initialize Firestore
export const db = getFirestore(firebaseApp);

// Set Firestore settings
db.settings({
  ignoreUndefinedProperties: true,
  timestampsInSnapshots: true,
});

// Connect to Firestore
export const connectDatabase = async (): Promise<void> => {
  try {
    // Simple test query to verify connection
    const testCollection = db.collection('connection_test');
    const testDoc = testCollection.doc('test');
    
    await testDoc.set({
      timestamp: Timestamp.now(),
      message: 'Connection test successful'
    });
    
    const doc = await testDoc.get();
    if (doc.exists) {
      logger.info('Firestore connection has been established successfully.');
      await testDoc.delete(); // Clean up test document
    } else {
      throw new Error('Failed to write test document to Firestore');
    }
  } catch (error) {
    logger.error('Unable to connect to Firestore:', error);
    throw error;
  }
};

// Utility functions for Firestore operations

/**
 * Create a document with auto-generated ID
 */
export const createDocument = async (
  collection: string,
  data: any
): Promise<string> => {
  const docRef = await db.collection(collection).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  
  return docRef.id;
};

/**
 * Create or update a document with a specific ID
 */
export const setDocument = async (
  collection: string,
  id: string,
  data: any,
  merge = true
): Promise<void> => {
  const updateData = {
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  };
  
  // If not merging or document doesn't exist, add createdAt
  if (!merge) {
    updateData.createdAt = FieldValue.serverTimestamp();
  }
  
  await db.collection(collection).doc(id).set(updateData, { merge });
};

/**
 * Update specific fields of a document
 */
export const updateDocument = async (
  collection: string,
  id: string,
  data: any
): Promise<void> => {
  await db.collection(collection).doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  });
};

/**
 * Get a document by ID
 */
export const getDocument = async (
  collection: string,
  id: string
): Promise<any | null> => {
  const doc = await db.collection(collection).doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  collection: string,
  id: string
): Promise<void> => {
  await db.collection(collection).doc(id).delete();
};

/**
 * Query documents with filters
 */
export const queryDocuments = async (
  collection: string,
  queries: Array<[string, FirebaseFirestore.WhereFilterOp, any]> = [],
  orderBy?: { field: string; direction?: 'asc' | 'desc' },
  limit?: number
): Promise<any[]> => {
  let query: FirebaseFirestore.Query = db.collection(collection);
  
  // Apply where clauses
  queries.forEach(([field, operator, value]) => {
    query = query.where(field, operator, value);
  });
  
  // Apply orderBy if provided
  if (orderBy) {
    query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
  }
  
  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Export Firestore types for convenience
export { Timestamp, FieldValue };