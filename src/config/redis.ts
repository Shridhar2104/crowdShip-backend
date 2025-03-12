import { createClient, RedisClientType } from 'redis';
import { config } from './index';
import { logger } from '../utils/logger';

// Create Redis client
export const redisClient: RedisClientType = createClient({
  url: `redis://${config.redis.password ? `:${config.redis.password}@` : ''}${config.redis.host}:${config.redis.port}`,
});

// Connect to Redis
export const initializeRedis = async (): Promise<void> => {
  try {
    redisClient.on('error', (err: any) => {
      logger.error('Redis Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis successfully');
    });

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

// Get cached data
export const getCache = async (key: string): Promise<string | null> => {
  return await redisClient.get(key);
};

// Set cache data
export const setCache = async (key: string, value: string, expireInSeconds?: number): Promise<void> => {
  if (expireInSeconds) {
    await redisClient.setEx(key, expireInSeconds, value);
  } else {
    await redisClient.set(key, value);
  }
};

// Delete cache
export const deleteCache = async (key: string): Promise<void> => {
  await redisClient.del(key);
};

// Clear all cache (use with caution)
export const clearCache = async (): Promise<void> => {
  await redisClient.flushAll();
};