import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import { env } from './env';
import { findOrCreateFromGoogleProfile } from '../services/auth.service';
import { UnauthorizedError } from '../utils/AppError';

/**
 * `scope` and `session: false` are set at the route level (Phase 5.5).
 * `state: true` enables CSRF protection for the OAuth handshake — it
 * stores a nonce in req.session (hence authSession must run before this
 * route), independent of the route's own session:false, which only
 * controls whether Passport creates a *login* session afterward.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      state: true,
    },
    (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
      const email = profile.emails?.[0]?.value;

      if (!email) {
        done(null, false, { message: 'Google account has no email' });
        return;
      }

      findOrCreateFromGoogleProfile({ googleId: profile.id, email, name: profile.displayName })
        .then((user) => done(null, user))
        .catch((err: unknown) => {
          // Expected rejections (wrong domain) fail auth cleanly; anything
          // else is a real system error and should propagate as one.
          if (err instanceof UnauthorizedError) {
            done(null, false, { message: err.message });
            return;
          }
          done(err);
        });
    },
  ),
);

export { passport };
