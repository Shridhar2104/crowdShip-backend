import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errorClasses';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If error is instance of ApiError, use its status code; otherwise, use 500
  let statusCode = 500;
  let message = 'Internal Server Error';
  let stack = undefined;
  let isOperational = false;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    stack = err.stack;
  } else {
    // For unknown errors, log with higher severity
    logger.error('Unhandled error:', { error: err, stack: err.stack });
  }

  // Log error details
  logger.error(`${statusCode} - ${message}`, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    isOperational,
  });

  // Prepare response object
  const errorResponse: any = {
    error: {
      status: statusCode,
      message,
    },
  };

  // Add stack trace in development environment
  if (config.nodeEnv === 'development' && stack) {
    errorResponse.error.stack = stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};