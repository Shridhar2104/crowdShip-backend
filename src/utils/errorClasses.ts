/**
 * Base API error class
 */
 export class ApiError extends Error {
    statusCode: number;
    isOperational: boolean;
  
    constructor(statusCode: number, message: string, isOperational = true) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = isOperational;
      
      // Capturing stack trace, excluding the constructor call from it
      Error.captureStackTrace(this, this.constructor);
      
      // Set the prototype explicitly
      Object.setPrototypeOf(this, ApiError.prototype);
    }
  }
  
  /**
   * 400 Bad Request - Invalid request from the client
   */
  export class BadRequestError extends ApiError {
    constructor(message = 'Bad Request') {
      super(400, message, true);
      Object.setPrototypeOf(this, BadRequestError.prototype);
    }
  }
  
  /**
   * 401 Unauthorized - Authentication failure
   */
  export class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized') {
      super(401, message, true);
      Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
  }
  
  /**
   * 403 Forbidden - User does not have permission
   */
  export class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden') {
      super(403, message, true);
      Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
  }
  
  /**
   * 404 Not Found - Resource not found
   */
  export class NotFoundError extends ApiError {
    constructor(message = 'Resource Not Found') {
      super(404, message, true);
      Object.setPrototypeOf(this, NotFoundError.prototype);
    }
  }
  
  /**
   * 409 Conflict - Resource conflict (e.g., duplicate entry)
   */
  export class ConflictError extends ApiError {
    constructor(message = 'Resource Conflict') {
      super(409, message, true);
      Object.setPrototypeOf(this, ConflictError.prototype);
    }
  }
  
  /**
   * 429 Too Many Requests - Rate limit exceeded
   */
  export class TooManyRequestsError extends ApiError {
    constructor(message = 'Too Many Requests') {
      super(429, message, true);
      Object.setPrototypeOf(this, TooManyRequestsError.prototype);
    }
  }
  
  /**
   * 500 Internal Server Error - Unexpected server error
   */
  export class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error') {
      super(500, message, false);
      Object.setPrototypeOf(this, InternalServerError.prototype);
    }
  }