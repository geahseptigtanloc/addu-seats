/**
 * JWT helpers for session tokens returned after Google OAuth login.
 * Tokens are stored client-side in localStorage (Phase 1).
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '7d';

/**
 * Sign a JWT containing the user's ID and role.
 * @param {{ userId: string, role: string }} payload
 * @returns {string}
 */
export function signToken({ userId, role }) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT.
 * @param {string} token
 * @returns {{ userId: string, role: string }}
 */
export function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.verify(token, JWT_SECRET);
}
