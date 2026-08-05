/**
 * Google OAuth strategy via Passport.
 * On first login, creates a user record with role 'student'.
 * Phase 6: add email domain restriction for @addu.edu.ph addresses.
 */
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from './database.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('Google account has no email address'));
        }

        // Upsert: create on first login, update name on subsequent logins
        const user = await prisma.user.upsert({
          where: { email },
          update: { name: profile.displayName || email },
          create: {
            email,
            name: profile.displayName || email,
            role: 'student',
          },
        });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

export default passport;
