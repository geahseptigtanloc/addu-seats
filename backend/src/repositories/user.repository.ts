import type { User, UserRole } from '@prisma/client';
import { prisma } from '../config/prisma';

export function findByGoogleId(googleId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { googleId } });
}

export interface CreateUserInput {
  googleId: string;
  email: string;
  name: string;
  role: UserRole;
}

export function create(data: CreateUserInput): Promise<User> {
  return prisma.user.create({ data });
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
}

export function update(id: string, data: UpdateUserInput): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

export function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}
