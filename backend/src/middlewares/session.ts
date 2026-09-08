import session from 'express-session';
import { env } from '../config/env';

/**
 * Mounted on the /auth router only, not globally. This exists
 * solely to survive Passport's OAuth redirect round-trip to Google and
 * back, which needs some server-side state to verify against.
 *
 * No session store configured (defaults to in-memory), which is normally
 * unsuitable for production, but acceptable here since this cookie only
 * needs to live for the few seconds a redirect takes, not for an actual
 * user session. Revisit with a Redis-backed store if this ever runs
 * across multiple instances.
 */
export const authSession = session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 5 * 60 * 1000,
    // 'lax', so that this cookie can survive the top-level
    // redirect Google sends the browser back on.
    sameSite: 'lax',
  },
});
