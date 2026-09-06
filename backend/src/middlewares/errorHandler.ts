import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Catches any request that didn't match a route. Must be mounted after all routes
 * and before the final error handler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

/**
 * Final error-handling middleware. Express identifies error middleware purely by
 * arity (4 params) so do not remove any of the four params even if unused, or
 * Express will treat this as a normal middleware and it will never be called.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { message: err.message },
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { message: 'Internal server error' },
  });
}
