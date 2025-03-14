import jwt, { SignOptions, Secret, JwtPayload } from 'jsonwebtoken';
import { config } from '../config';

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  [key: string]: any;
}

/**
 * Generate JWT access token
 * @param payload User information to include in token
 * @returns Access token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  const secretKey: Secret = config.jwt.accessSecret;
  const options: SignOptions = {
    expiresIn: (config.jwt.accessExpiresIn),
  };
  
  return jwt.sign(payload, secretKey, options);
};

/**
 * Generate JWT refresh token
 * @param payload User information to include in token
 * @returns Refresh token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  const secretKey: Secret = config.jwt.refreshSecret;
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiresIn,
  };
  
  return jwt.sign(payload, secretKey, options);
};

/**
 * Verify JWT token
 * @param token Token to verify
 * @param secret Secret used to sign the token
 * @returns Decoded token payload
 */
export const verifyToken = (token: string, secret: string): Promise<TokenPayload> => {
  return new Promise((resolve, reject) => {
    const secretKey: Secret = secret;
    
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        return reject(err);
      }
      resolve(decoded as TokenPayload);
    });
  });
};

/**
 * Generate both access and refresh tokens
 * @param user User object
 * @returns Object containing both tokens
 */
export const generateTokens = (user: { id: string; email: string; role: string }): {
  accessToken: string;
  refreshToken: string;
} => {
  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};