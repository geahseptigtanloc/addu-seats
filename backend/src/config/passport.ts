import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import { env } from './env';
import { findOrCreateFromGoogleProfile } from '../services/auth.service';

/**
 * `scope` and `session: false` are set at the route level,
 * not here, see passport-google-oauth20 convention and the architecture
 * doc's JWT-only auth decision.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
      const email = profile.emails?.[0]?.value;

      if (!email) {
        done(new Error('Google account has no email'));
        return;
      }

      findOrCreateFromGoogleProfile({ googleId: profile.id, email, name: profile.displayName })
        .then((user) => done(null, user))
        .catch((err: unknown) => done(err));
    },
  ),
);

export { passport };
