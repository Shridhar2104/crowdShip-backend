import { Sequelize } from 'sequelize';
import { config } from './index';
import { logger } from '../utils/logger';

const { database } = config;

// Create Sequelize instance
export const sequelize = new Sequelize(
  database.name,
  database.username,
  database.password,
  {
    host: database.host,
    port: database.port,
    dialect: 'postgres',
    logging: (msg: any) => logger.debug(msg),
    dialectOptions: {
      ssl: config.nodeEnv === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Connect to database
export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    
    if (config.nodeEnv === 'development') {
      // In development, sync database schema (careful in production!)
      await sequelize.sync({ alter: true });
      logger.info('Database schema synchronized.');
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};