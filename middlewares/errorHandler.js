const ActivityLogger = require('../services/activityLogger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Error types
const ErrorTypes = {
  VALIDATION_ERROR: 'ValidationError',
  AUTHENTICATION_ERROR: 'AuthenticationError',
  AUTHORIZATION_ERROR: 'AuthorizationError',
  NOT_FOUND: 'NotFoundError',
  CONFLICT: 'ConflictError',
  DATABASE_ERROR: 'DatabaseError',
  FILE_ERROR: 'FileError',
  EXTERNAL_SERVICE_ERROR: 'ExternalServiceError',
  RATE_LIMIT_ERROR: 'RateLimitError'
};

// Development error response
const sendErrorDev = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    status: 'error',
    error: err.message,
    stack: err.stack,
    details: err.details,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

// Production error response
const sendErrorProd = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(statusCode).json({
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString()
    });
  }
};

// Handle specific error types
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large', 400);
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(`Unexpected field: ${err.field}`, 400);
  }
  return new AppError('File upload error', 400);
};

const handleSequelizeError = (err) => {
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => e.message);
    return new AppError(`Validation error: ${errors.join(', ')}`, 400);
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    const fields = Object.keys(err.fields).join(', ');
    return new AppError(`Duplicate value for: ${fields}`, 400);
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return new AppError('Foreign key constraint error', 400);
  }
  return new AppError('Database error', 500);
};

// Main error handling middleware
const errorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error to activity log if user is authenticated
  if (req.user) {
    try {
      await ActivityLogger.logError(req.user, error, req);
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Handle specific error types
  if (error.name === 'CastError') error = handleCastErrorDB(error);
  if (error.code === 11000) error = handleDuplicateFieldsDB(error);
  if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (error.name === 'MulterError') error = handleMulterError(error);
  if (error.name?.startsWith('Sequelize')) error = handleSequelizeError(error);

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const message = `Cannot find ${req.originalUrl} on this server!`;
  const err = new AppError(message, 404);
  next(err);
};

module.exports = {
  AppError,
  asyncHandler,
  ErrorTypes,
  errorHandler,
  notFoundHandler
};
