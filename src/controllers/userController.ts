import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../models';
import { generateTokens, verifyToken } from '../utils/jwt';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errorClasses';
import { logger } from '../utils/logger';
import { config } from '../config';
import { db,Timestamp } from '../config/database';


/**
 * Register a new user
 * @route POST /api/v1/users/register
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, email, password, phoneNumber, role } = req.body;

    // Check if user with email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new BadRequestError('User with this email already exists');
    }

    // Check if user with phone number already exists
    const phoneUsers = await db.collection('users')
      .where('phoneNumber', '==', phoneNumber)
      .limit(1)
      .get();
    
    if (!phoneUsers.empty) {
      throw new BadRequestError('User with this phone number already exists');
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password, // Will be hashed in the User class
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
    const user = await User.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check password
    const isMatch = await user.isPasswordMatch(password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login time
    await user.updateLoginTimestamp();

    // Generate tokens
    const tokens = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // TODO: Store refresh token in Firestore or Redis for management

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

    // TODO: Check if refresh token is in Firestore/Redis and not expired/revoked

    // Generate new tokens
    const tokens = generateTokens({
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    });

    // TODO: Update refresh token in Firestore/Redis

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
    // TODO: Invalidate refresh token in Firestore/Redis

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

    const user = await User.findById(userId);
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

    const user = await User.findById(userId);
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

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isMatch = await user.isPasswordMatch(currentPassword);
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Update password
    user.password = newPassword; // Will be hashed by the save method
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

    const user = await User.findByEmail(email);
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
    const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    // Update user with reset token and expiry
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetPasswordExpires;
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

    // Query for user with matching token
    const usersSnapshot = await db.collection('users')
      .where('resetPasswordToken', '==', token)
      .get();

    if (usersSnapshot.empty) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    // Find valid user with non-expired token
    let validUser = null;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      // Check if resetPasswordExpires exists and is not expired
      if (userData.resetPasswordExpires) {
        // Convert Firestore timestamp to Date if needed
        const expiryDate = userData.resetPasswordExpires instanceof Timestamp ? 
          userData.resetPasswordExpires.toDate() : new Date(userData.resetPasswordExpires);
        
        if (expiryDate > new Date()) {
          // Create a complete user object with all required fields
          validUser = await User.findById(doc.id);
          break;
        }
      }
    }

    if (!validUser) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    // Update password and clear reset token
    validUser.password = password; // Will be hashed during save
    validUser.resetPasswordToken = undefined;
    validUser.resetPasswordExpires = undefined;
    await validUser.save();

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

    // Query for user with matching verification token
    const usersSnapshot = await db.collection('users')
      .where('verificationToken', '==', token)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      throw new BadRequestError('Email verification token is invalid');
    }

    // Get the first matching user's ID
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    
    // Use the User.findById method to get a properly constructed User object
    const user = await User.findById(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
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

    const user = await User.findById(userId);
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
    
    // Get users from Firestore with pagination
    const usersSnapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset((page - 1) * limit)
      .get();
    
    // Convert to User instances
    const users: User[] = [];
    const userPromises = usersSnapshot.docs.map(doc => User.findById(doc.id));
    const userResults = await Promise.all(userPromises);
    
    // Filter out any null results (in case a user was deleted during the query)
    users.push(...userResults.filter(user => user !== null) as User[]);
    
    // Get total count for pagination
    const countSnapshot = await db.collection('users').count().get();
    const count = countSnapshot.data().count;
    
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

    const user = await User.findById(id);
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

    const user = await User.findById(id);
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

    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const success = await User.delete(id);
    if (!success) {
      throw new Error('Failed to delete user');
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};