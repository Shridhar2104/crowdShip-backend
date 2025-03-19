import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';

// Set port
const port = config.port || 5000;

// Connect to database when the app starts
connectDatabase().catch((error) => {
  logger.error('Failed to connect to database:', error);
});

// Start server
const startServer = async () => {
  try {
    // Start listening
    app.listen(port, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on port ${port}`);
      logger.info(`API is available at http://localhost:${port}/api/${config.apiVersion}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
//   logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
//   // Close server & exit process
//   server.close(() => process.exit(1));
// });

// // Handle uncaught exceptions
// process.on('uncaughtException', (error: Error) => {
//   logger.error('Uncaught Exception:', error);
//   // Close server & exit process
//   server.close(() => process.exit(1));
// });

// // Handle SIGTERM
// process.on('SIGTERM', () => {
//   logger.info('SIGTERM received. Shutting down gracefully');
//   server.close(() => {
//     logger.info('Process terminated');
//   });
// });

// Start the server
startServer();

// Export the Express app for Vercel
export default app;