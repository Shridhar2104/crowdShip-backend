import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as paymentController from '../controllers/paymentController';

const router: Router = express.Router();

/**
 * @route   POST /api/v1/payments
 * @desc    Create a payment (admin only)
 * @access  Private (admin)
 */
router.post('/', authenticate, authorize(['admin']), paymentController.createPayment);

/**
 * @route   GET /api/v1/payments
 * @desc    Get all payments (admin only)
 * @access  Private (admin)
 */
router.get('/', authenticate, authorize(['admin']), paymentController.getAllPayments);

/**
 * @route   GET /api/v1/payments/me
 * @desc    Get current user's payments
 * @access  Private
 */
router.get('/me', authenticate, paymentController.getUserPayments);

/**
 * @route   GET /api/v1/payments/:id
 * @desc    Get payment by ID
 * @access  Private
 */
router.get('/:id', authenticate, paymentController.getPaymentById);

/**
 * @route   POST /api/v1/payments/package/:packageId
 * @desc    Process payment for a package
 * @access  Private (sender)
 */
router.post('/package/:packageId', authenticate, authorize(['sender']), paymentController.processPackagePayment);

/**
 * @route   POST /api/v1/payments/carrier-payout/:matchId
 * @desc    Process payout for a carrier (admin only)
 * @access  Private (admin)
 */
router.post('/carrier-payout/:matchId', authenticate, authorize(['admin']), paymentController.processCarrierPayout);

/**
 * @route   POST /api/v1/payments/:id/refund
 * @desc    Refund a payment (admin only)
 * @access  Private (admin)
 */
router.post('/:id/refund', authenticate, authorize(['admin']), paymentController.refundPayment);

/**
 * @route   POST /api/v1/payments/calculate-price
 * @desc    Calculate delivery price
 * @access  Private
 */
router.post('/calculate-price', authenticate, paymentController.calculatePrice);

/**
 * @route   POST /api/v1/payments/stripe-webhook
 * @desc    Handle Stripe webhook events
 * @access  Public
 */
router.post('/stripe-webhook', paymentController.stripeWebhook);

/**
 * @route   GET /api/v1/payments/summary
 * @desc    Get payment summary (admin only)
 * @access  Private (admin)
 */
router.get('/summary', authenticate, authorize(['admin']), paymentController.getPaymentSummary);

/**
 * @route   GET /api/v1/payments/earnings
 * @desc    Get carrier earnings
 * @access  Private (carrier)
 */
router.get('/earnings', authenticate, authorize(['carrier']), paymentController.getCarrierEarnings);

/**
 * @route   POST /api/v1/payments/setup-intent
 * @desc    Create a SetupIntent for saving payment method
 * @access  Private
 */
router.post('/setup-intent', authenticate, paymentController.createSetupIntent);

/**
 * @route   GET /api/v1/payments/payment-methods
 * @desc    Get user's saved payment methods
 * @access  Private
 */
router.get('/payment-methods', authenticate, paymentController.getPaymentMethods);

/**
 * @route   DELETE /api/v1/payments/payment-methods/:id
 * @desc    Delete a payment method
 * @access  Private
 */
router.delete('/payment-methods/:id', authenticate, paymentController.deletePaymentMethod);

export default router;