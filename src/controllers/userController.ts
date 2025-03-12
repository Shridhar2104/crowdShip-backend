import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../models';
import { generateTokens, verifyToken } from '../utils/jwt';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errorClasses';
import { logger } from '../utils/logger';
import { config } from '../config';
import { Op } from 'sequelize';

/**
 * Register a new user
 * @route POST /api/v1/users/register
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, password, phoneNumber, role } = req.body;

    // Check if user with email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new BadRequestError('User with this email already exists');
    }

    // Check if user with phone number already exists
    const existingPhoneUser = await User.findOne({ where: { phoneNumber } });
    if (existingPhoneUser) {
      throw new BadRequestError('User with this phone number already exists');
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password, // Will be hashed by model hook
      phoneNumber,
      role: role || 'sender', // Default role is sender
      verificationToken,
      isVerified: false,
    });

    // TODO: Send verification email

    // Return user data (excluding sensitive information)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/v1/users/login
 */
export const loginUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check password
    const isMatch = await user.isPasswordMatch(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login time
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // TODO: Store refresh token in database or Redis for management

    // Send response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toPublicJSON(),
        tokens,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * @route POST /api/v1/users/refresh-token
 */
export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }

    // Verify refresh token
    const decoded = await verifyToken(refreshToken, config.jwt.refreshSecret as string);

    // TODO: Check if refresh token is in database/Redis and not expired/revoked

    // Generate new tokens
    const tokens = generateTokens({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    // TODO: Update refresh token in database/Redis

    // Send response
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens,
      },
    });
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired refresh token'));
  }
};

/**
 * Logout user
 * @route POST /api/v1/users/logout
 */
export const logoutUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // TODO: Invalidate refresh token in database/Redis

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/v1/users/me
 */
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.status(200).json({
      success: true,
      data: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 * @route PUT /api/v1/users/me
 */
export const updateCurrentUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, phoneNumber, profileImageUrl } = req.body;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update user fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (profileImageUrl) user.profileImageUrl = profileImageUrl;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user password
 * @route PUT /api/v1/users/me/password
 */
export const updatePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    if (!currentPassword || !newPassword) {
      throw new BadRequestError('Current password and new password are required');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isMatch = await user.isPasswordMatch(currentPassword);
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Update password
    user.password = newPassword; // Will be hashed by model hook
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset email
 * @route POST /api/v1/users/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new BadRequestError('Email is required');
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Still return success for security reasons
      res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link',
      });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Update user with reset token and expiry
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();

    // TODO: Send password reset email

    logger.info(`Password reset requested for user: ${user.id}`);

    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with token
 * @route POST /api/v1/users/reset-password/:token
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      throw new BadRequestError('New password is required');
    }

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() }, // Token not expired
      },
    });

    if (!user) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    // Update password and clear reset token
    user.password = password; // Will be hashed by model hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // TODO: Send password changed confirmation email

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email address
 * @route POST /api/v1/users/verify-email/:token
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: {
        verificationToken: token,
      },
    });

    if (!user) {
      throw new BadRequestError('Email verification token is invalid');
    }

    // Mark user as verified and clear verification token
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend email verification
 * @route POST /api/v1/users/resend-verification
 */
export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestError('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await user.save();

    // TODO: Send verification email

    res.status(200).json({
      success: true,
      message: 'Verification email has been sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users (admin only)
 * @route GET /api/v1/users
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Parse query parameters for pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get total count and users
    const { count, rows: users } = await User.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    // Map users to public JSON
    const usersData = users.map(user => user.toPublicJSON());

    res.status(200).json({
      success: true,
      data: {
        users: usersData,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 * @route GET /api/v1/users/:id
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if requesting user is the user or an admin
    if (req.user?.id !== id && req.user?.role !== 'admin') {
      // Return limited public info
      res.status(200).json({
        success: true,
        data: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user (admin only)
 * @route PUT /api/v1/users/:id
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phoneNumber, role, isVerified } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update user fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (role) user.role = role;
    if (isVerified !== undefined) user.isVerified = isVerified;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (admin only)
 * @route DELETE /api/v1/users/:id
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};