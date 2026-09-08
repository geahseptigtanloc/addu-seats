import { UserRole, type User } from '@prisma/client';
import { env } from '../config/env';
import * as userRepository from '../repositories/user.repository';
import { UnauthorizedError } from '../utils/AppError';
import { randomBytes } from 'node:crypto';
import { redisClient } from '../config/redis';
import { signToken } from '../utils/jwt';
export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

const EXCHANGE_CODE_PREFIX = 'auth:exchange:';
const EXCHANGE_CODE_TTL_SECONDS = 60;

function isSchoolEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${env.SCHOOL_EMAIL_DOMAIN.toLowerCase()}`);
}

function isStaffEmail(email: string): boolean {
  return env.STAFF_EMAILS.includes(email.toLowerCase());
}

/**
 * Find-or-create a User from a verified Google profile. Matches on
 * googleId, not email, so a changed school email doesn't create a
 * duplicate account. Role is recomputed against STAFF_EMAILS on every
 * login (not just at creation), so removing someone from the allow-list
 * takes effect next time they sign in, without a manual DB update.
 */
export async function findOrCreateFromGoogleProfile(profile: GoogleProfile): Promise<User> {
  if (!isSchoolEmail(profile.email)) {
    throw new UnauthorizedError(`Only @${env.SCHOOL_EMAIL_DOMAIN} accounts may sign in`);
  }

  const role = isStaffEmail(profile.email) ? UserRole.ADMIN : UserRole.STUDENT;
  const existing = await userRepository.findByGoogleId(profile.googleId);

  if (!existing) {
    return userRepository.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      role,
    });
  }

  const hasChanges =
    existing.email !== profile.email || existing.name !== profile.name || existing.role !== role;

  if (!hasChanges) {
    return existing;
  }

  return userRepository.update(existing.id, { email: profile.email, name: profile.name, role });
}

/**
 * Short-lived, one-time-use code exchanged for a JWT after OAuth succeeds.
 * Redirecting straight back to the frontend with the JWT itself would put
 * a 5-hour-lived credential in the URL (browser history, server logs,
 * Referer headers).
 *
 * this code is useless after 60s or one use, whichever
 * comes first, so the actual token never touches a URL.
 */
export async function createExchangeCode(user: User): Promise<string> {
  const code = randomBytes(32).toString('hex');
  const token = signToken({ userId: user.id, role: user.role });
  await redisClient.set(`${EXCHANGE_CODE_PREFIX}${code}`, token, { EX: EXCHANGE_CODE_TTL_SECONDS });
  return code;
}

export async function redeemExchangeCode(code: string): Promise<string | null> {
  // getDel, not get+del — atomic, so two concurrent requests for the same
  // code can't both succeed (get-then-delete would have that race).
  return redisClient.getDel(`${EXCHANGE_CODE_PREFIX}${code}`);
}
