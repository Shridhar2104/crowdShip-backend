import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { logger } from './utils/logger';

// Import routes
import userRoutes from './routes/userRoutes';
import packageRoutes from './routes/packageRoutes';
import matchingRoutes from './routes/matchingRoutes';
// import paymentRoutes from './routes/paymentRoutes';
// import notificationRoutes from './routes/notificationRoutes';
//import ratingRoutes from './routes/ratingRoutes';
import carbonRoutes from './routes/carbonRoutes';

const app: Express = express();

// Security and utility middleware
app.use(helmet());

app.use(cors({}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// API routes
const apiVersion = config.apiVersion;
app.use(`/api/${apiVersion}/users`, userRoutes);
app.use(`/api/${apiVersion}/packages`, packageRoutes);

 //app.use(`/api/${apiVersion}/routes`, routeRoutes);
app.use(`/api/${apiVersion}/matches`, matchingRoutes);
//app.use(`/api/${apiVersion}/notifications`, notificationRoutes);
//app.use(`/api/${apiVersion}/ratings`, ratingRoutes);

//app.use(`/api/${apiVersion}/matches`, matchingRoutes);

// app.use(`/api/${apiVersion}/payments`, paymentRoutes);
app.use(`/api/${apiVersion}/carbon`, carbonRoutes); 


// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;