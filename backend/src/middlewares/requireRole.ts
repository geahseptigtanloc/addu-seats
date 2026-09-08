import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { logger } from '../config/logger';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError';

/**
 * Must run AFTER requireAuth on a route,
 * checks req.user.role against the allowed list.
 * Missing req.user means requireAuth wasn't applied
 * which means probably a wiring mistake, logged so it's caught during testing
 * rather than silently misbehaving.
 */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      logger.warn('requireRole used without requireAuth running first');
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}
