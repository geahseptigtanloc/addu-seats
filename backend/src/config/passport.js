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



        // Find-or-create: match by googleId first, then fall back to email.
        // This avoids duplicate rows AND avoids unique-constraint errors when
        // an existing email-only row hasn't been linked to a googleId yet.
        let user = await prisma.user.findUnique({ where: { googleId: profile.id } });

        if (user) {
          // Returning user — update email/name in case they changed on Google's side
          user = await prisma.user.update({
            where: { googleId: profile.id },
            data: { email, name: profile.displayName || email },
          });
        } else {
          // No row with this googleId yet — check if one already exists for this email
          user = await prisma.user.findUnique({ where: { email } });

          if (user) {
            // Existing user logging in with Google for the first time — link googleId
            user = await prisma.user.update({
              where: { email },
              data: { googleId: profile.id, name: profile.displayName || email },
            });
          } else {
            // Brand-new user
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email,
                name: profile.displayName || email,
                role: 'student',
              },
            });
          }
        }

        // Apply staff allowlist
        const staffEmails = (process.env.STAFF_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        if (staffEmails.includes(email.toLowerCase()) && user.role === 'student') {
          user = await prisma.user.update({
            where: { userId: user.userId },
            data: { role: 'staff' },
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

export default passport;
