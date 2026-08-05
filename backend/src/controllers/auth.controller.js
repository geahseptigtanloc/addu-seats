/**
 * Authentication controller — Google OAuth flow and current-user endpoint.
 */
import { signToken } from '../config/jwt.js';
import prisma from '../config/database.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Passport calls this after a successful Google login.
 * Issues a JWT and redirects the browser back to the frontend.
 */
export function googleCallback(req, res) {
  const user = req.user;
  if (!user) {
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }

  const token = signToken({ userId: user.userId, role: user.role });

  // Pass token via query param; frontend stores it in localStorage
  res.redirect(`${FRONTEND_URL}/login?token=${token}`);
}

/**
 * Return the authenticated user's profile.
 * Requires auth middleware (Bearer token).
 */
export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: req.user.userId },
      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        adduIdLast4: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}
