import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * Shape of the data embedded in every access token.
 * It's kept minimal, anything else needed by a request should be looked up from the DB using
 * userId, not stuffed into the token (tokens can't be invalidated early,
 * so anything embedded in one is effectively true for up to JWT_EXPIRES_IN
 * even if it changes in the DB afterward).
 */
export interface JwtPayload {
  userId: string;
  role: 'STUDENT' | 'ADMIN';
}

/**
 * The cast below is required, jsonwebtoken's expiresIn
 * only accepts a restrictive template-literal type (e.g. "5h", "30m"), not
 * a plain string, but JWT_EXPIRES_IN comes through Zod as a plain string.
 * The value is only ever our own controlled env var (default "5h"), so the
 * risk is low; an invalid format throws a clear error at startup rather
 * than silently misbehaving.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
