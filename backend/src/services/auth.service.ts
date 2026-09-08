import { UserRole, type User } from '@prisma/client';
import { env } from '../config/env';
import * as userRepository from '../repositories/user.repository';
import { UnauthorizedError } from '../utils/AppError';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
}

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
