import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { config } from './index';

// Socket connection events
export const initializeSocketIO = (io: SocketIOServer): void => {
  // Authentication middleware
  io.use(async (socket: Socket, next: any) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }
      
      const decoded = await verifyToken(token, config.jwt.accessSecret);
      socket.data.user = decoded;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.user?.id;
    logger.info(`User connected: ${userId}`);
    
    // Join user-specific room
    socket.join(`user:${userId}`);
    
    // Location updates for carriers
    socket.on('location:update', (data: { latitude: number; longitude: number; accuracy?: number }) => {
      // Validate data
      if (!data.latitude || !data.longitude) {
        socket.emit('error', { message: 'Invalid location data' });
        return;
      }
      
      // Update carrier location in database (handled by service)
      // Emit location to all relevant subscribers (e.g., package sender)
      io.to(`package:tracking:${socket.data.activeDeliveryId}`).emit('carrier:location', {
        carrierId: userId,
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: data.accuracy || null,
          timestamp: new Date().toISOString()
        }
      });
      
      logger.debug(`Location updated for carrier ${userId}`);
    });
    
    // Active delivery management
    socket.on('delivery:start', (deliveryId: string) => {
      socket.data.activeDeliveryId = deliveryId;
      socket.join(`delivery:${deliveryId}`);
      io.to(`package:${deliveryId}`).emit('delivery:started', { deliveryId, carrierId: userId });
      logger.info(`Carrier ${userId} started delivery ${deliveryId}`);
    });
    
    socket.on('delivery:complete', (deliveryId: string) => {
      socket.leave(`delivery:${deliveryId}`);
      delete socket.data.activeDeliveryId;
      io.to(`package:${deliveryId}`).emit('delivery:completed', { deliveryId, carrierId: userId });
      logger.info(`Carrier ${userId} completed delivery ${deliveryId}`);
    });
    
    // Package tracking for senders
    socket.on('package:track', (packageId: string) => {
      socket.join(`package:tracking:${packageId}`);
      logger.info(`User ${userId} tracking package ${packageId}`);
    });
    
    socket.on('package:untrack', (packageId: string) => {
      socket.leave(`package:tracking:${packageId}`);
      logger.info(`User ${userId} stopped tracking package ${packageId}`);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${userId}`);
      
      // Clean up any active subscriptions or tracking
      if (socket.data.activeDeliveryId) {
        io.to(`package:${socket.data.activeDeliveryId}`).emit('carrier:offline', { 
          carrierId: userId,
          deliveryId: socket.data.activeDeliveryId
        });
      }
    });
  });

}