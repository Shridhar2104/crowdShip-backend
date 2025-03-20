import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server configuration
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5001', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8081',
  
  // Database configuration
  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    name: process.env.POSTGRES_DB || 'crowdship',
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    dialect: 'postgres',
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // JWT configuration
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    accessExpiresIn:15*60*60, // 15 minutes
    refreshExpiresIn:24*7*60*60, // 7 days
  },
  
  // Google Maps API
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },
  
  // Stripe configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  
  // Email configuration
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'no-reply@crowdship.com',
  },
  
  // SMS configuration
  sms: {
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || 'CROWDSP',
  },
  
  // File storage configuration
  storage: {
    bucketName: process.env.S3_BUCKET || 'crowdship-files',
    region: process.env.S3_REGION || 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
  },
  
  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Rate limiting
  rateLimit: {
    window: process.env.RATE_LIMIT_WINDOW || '15m',
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
};