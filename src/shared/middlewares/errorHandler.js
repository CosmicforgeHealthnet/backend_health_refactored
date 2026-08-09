// src/shared/middlewares/errorHandler.js

/**
 * Global error handler middleware for Express
 * @param {Error} err - The error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: err.message,
            details: err.details || undefined
        });
    }

    if (err.name === 'UnauthorizedError' || err.status === 401) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: err.message || 'Authentication required'
        });
    }

    if (err.status === 403 || err.name === 'ForbiddenError') {
        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: err.message || 'Access denied'
        });
    }

    if (err.status === 404 || err.name === 'NotFoundError') {
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: err.message || 'Resource not found'
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid Token',
            message: 'Invalid or malformed authentication token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token Expired',
            message: 'Authentication token has expired'
        });
    }

    // TypeORM/Database errors
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            error: 'Conflict',
            message: 'A record with this information already exists'
        });
    }

    // Default to 500 Internal Server Error
    // err.status can be a non-numeric string (e.g. AppError sets 'fail'/'error'), so
    // prefer numeric statusCode and only fall back to err.status when it's a number.
    const statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : null) || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message || 'Something went wrong';

    res.status(statusCode).json({
        success: false,
        error: 'Server Error',
        message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
}

module.exports = errorHandler;
