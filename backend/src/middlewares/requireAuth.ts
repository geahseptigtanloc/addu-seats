import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import * as userRepository from '../repositories/user.repository';
import { UnauthorizedError } from '../utils/AppError';

/**
 * Verifies the Bearer JWT and attaches the current User to req.user.
 * Looks the user up fresh from the DB on every request rather than
 * trusting the token's embedded role, so a deleted account or changed
 * role takes effect immediately instead of waiting out the token's
 * 5-hour expiry.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
    return;
  }

  try {
    const user = await userRepository.findById(payload.userId);

    if (!user) {
      next(new UnauthorizedError('User no longer exists'));
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    next(err); // genuine system error (e.g. DB down) — not a 401
  }
}
