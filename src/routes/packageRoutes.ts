import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as packageController from '../controllers/packageController';

const router: Router = express.Router();

/**
 * @route   POST /api/v1/packages
 * @desc    Create a new package
 * @access  Private (sender)
 */
router.post('/', authorize(['sender', 'admin']), packageController.createPackage);

/**
 * @route   GET /api/v1/packages
 * @desc    Get all packages (filtered by query params)
 * @access  Private
 */
router.get('/', authenticate, packageController.getPackages);

/**
 * @route   GET /api/v1/packages/me
 * @desc    Get current user's packages
 * @access  Private
 */
router.get('/me', authenticate, packageController.getUserPackages);

/**
 * @route   GET /api/v1/packages/:id
 * @desc    Get package by ID
 * @access  Private
 */
router.get('/:id', authenticate, packageController.getPackageById);

/**
 * @route   PUT /api/v1/packages/:id
 * @desc    Update package
 * @access  Private (sender or admin)
 */
router.put('/:id', authenticate, packageController.updatePackage);

/**
 * @route   DELETE /api/v1/packages/:id
 * @desc    Cancel package
 * @access  Private (sender or admin)
 */
router.delete('/:id', authenticate, packageController.cancelPackage);

/**
 * @route   GET /api/v1/packages/:id/tracking
 * @desc    Get package tracking information
 * @access  Public (with tracking code)
 */
router.get('/:id/tracking', packageController.trackPackage);

/**
 * @route   POST /api/v1/packages/:id/pickup
 * @desc    Mark package as picked up
 * @access  Private (carrier only)
 */
router.post('/:id/pickup', authenticate, authorize(['carrier']), packageController.pickupPackage);

/**
 * @route   POST /api/v1/packages/:id/deliver
 * @desc    Mark package as delivered
 * @access  Private (carrier only)
 */
router.post('/:id/deliver', authenticate, authorize(['carrier']), packageController.deliverPackage);

/**
 * @route   POST /api/v1/packages/:id/confirm-delivery
 * @desc    Confirm package delivery
 * @access  Private (sender only)
 */
router.post('/:id/confirm-delivery', authenticate, authorize(['sender']), packageController.confirmDelivery);

/**
 * @route   POST /api/v1/packages/:id/report-issue
 * @desc    Report an issue with a package
 * @access  Private
 */
router.post('/:id/report-issue', authenticate, packageController.reportIssue);

/**
 * @route   GET /api/v1/packages/:id/timeline
 * @desc    Get package status timeline
 * @access  Private
 */
router.get('/:id/timeline', authenticate, packageController.getPackageTimeline);

/**
 * @route   POST /api/v1/packages/:id/upload-image
 * @desc    Upload package image
 * @access  Private
 */
router.post('/:id/upload-image', authenticate, packageController.uploadPackageImage);

export default router;