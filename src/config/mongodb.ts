import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

// Explicitly use new URL parser and unified topology
const options = {
  ...config.mongodb.options,
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

/**
 * Initialize MongoDB connection
 */
export const initializeMongoDB = async (): Promise<mongoose.Connection | null> => {
  try {
    // Clear any existing connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Closed existing MongoDB connection');
    }

    // Connect to MongoDB with timeout
    logger.info(`Connecting to MongoDB: ${config.mongodb.uri}`);
    await mongoose.connect(config.mongodb.uri, options);
    
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
    
    // Test the connection with a simple operation
    // This helps verify that the connection is fully working
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      logger.info('MongoDB connection verified with successful ping');
    } else {
      logger.warn('MongoDB connection established but db property is undefined');
    }
    
    return db;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    // Return null explicitly to indicate failure
    return null;
  }
};

// Export for direct use
export const mongoConnection = initializeMongoDB();

export default { initializeMongoDB, mongoConnection };