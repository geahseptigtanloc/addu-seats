import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import { env } from './env';

/**
 * Registers the Google OAuth strategy.
 * `scope` (['profile', 'email']) is deliberately not set here.
 * per passport-google-oauth20 convention it
 * belongs on the `passport.authenticate('google', { scope: [...] })` call
 * at the route level.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    (_accessToken: string, _refreshToken: string, _profile: Profile, done: VerifyCallback) => {
      // TODO later: find-or-create User by googleId (not email),
      // grant the 'admin' role automatically if the email matches STAFF_EMAILS.
      //
      // Note: The Google Cloud OAuth consent screen for this project
      // is "External" type (not "Internal"/Workspace-restricted, which needs
      // Workspace admin access most student developers won't have)
      // so Google does NOT enforce that only @addu.edu.ph accounts can sign
      // in. That restriction must be checked explicitly in this callback
      // (e.g. reject if profile.emails[0].value doesn't end with the
      // school's domain) rather than assumed from Console configuration.
      done(new Error('Google OAuth verify callback not implemented yet'));
    },
  ),
);

export { passport };
