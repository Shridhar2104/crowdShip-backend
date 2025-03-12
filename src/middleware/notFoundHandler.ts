import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../utils/errorClasses';

/**
 * Middleware to handle 404 Not Found errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
};