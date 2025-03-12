import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { initializeSocketIO } from './config/socket';
import { initializeRedis } from './config/redis';

// Create HTTP server
const server = http.createServer(app);

// Set port
const port = config.port || 5000;

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize Socket.IO
initializeSocketIO(io);

// Start server
const startServer = async () => {
  try {
    // Connect to databases
    await connectDatabase();
    await initializeRedis();

    // Start listening
    server.listen(port, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on port ${port}`);
      logger.info(`API is available at http://localhost:${port}/api/${config.apiVersion}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

// Start the server
startServer();