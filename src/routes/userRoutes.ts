import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddlerware';
import * as userController from '../controllers/userController';

const router: Router = express.Router();

/**
 * @route   POST /api/v1/users/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', userController.registerUser);

/**
 * @route   POST /api/v1/users/login
 * @desc    Login user & get token
 * @access  Public
 */
router.post('/login', userController.loginUser);

/**
 * @route   POST /api/v1/users/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh-token', userController.refreshToken);

/**
 * @route   POST /api/v1/users/logout
 * @desc    Logout user & invalidate token
 * @access  Private
 */
router.post('/logout', authenticate, userController.logoutUser);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, userController.getCurrentUser);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', authenticate, userController.updateCurrentUser);

/**
 * @route   PUT /api/v1/users/me/password
 * @desc    Update current user password
 * @access  Private
 */
router.put('/me/password', authenticate, userController.updatePassword);

/**
 * @route   POST /api/v1/users/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', userController.forgotPassword);

/**
 * @route   POST /api/v1/users/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', userController.resetPassword);

/**
 * @route   POST /api/v1/users/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email/:token', userController.verifyEmail);

/**
 * @route   POST /api/v1/users/resend-verification
 * @desc    Resend email verification
 * @access  Private
 */
router.post('/resend-verification', authenticate, userController.resendVerification);

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/', authenticate, authorize(['admin']), userController.getAllUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', authenticate, userController.getUserById);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put('/:id', authenticate, authorize(['admin']), userController.updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user (admin only)
 * @access  Private/Admin
 */
router.delete('/:id', authenticate, authorize(['admin']), userController.deleteUser);

export default router;