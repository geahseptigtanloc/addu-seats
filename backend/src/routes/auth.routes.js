/**
 * Authentication routes — Google OAuth and current-user profile.
 */
import { Router } from 'express';
import passport from '../config/passport.js';
import { googleCallback, getMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Step 1: redirect browser to Google's consent screen
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Step 2: Google redirects back here after user approves
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/failure' }),
  googleCallback
);

// Failure fallback (redirects to frontend login with error flag)
router.get('/failure', (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/login?error=auth_failed`);
});

// Protected: return logged-in user's profile
router.get('/me', requireAuth, getMe);

export default router;
