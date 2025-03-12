import express, { Router } from 'express';
import userRoutes from './userRoutes';
import packageRoutes from './packageRoutes';
import routeRoutes from './routeRoutes';
import matchingRoutes from './matchingRoutes';
import paymentRoutes from './paymentRoutes';
import notificationRoutes from './notificationRoutes';
import ratingRoutes from './ratingRoutes';

const router: Router = express.Router();

// Use route files
router.use('/users', userRoutes);
router.use('/packages', packageRoutes);
router.use('/routes', routeRoutes);
router.use('/matches', matchingRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ratings', ratingRoutes);

export default router;