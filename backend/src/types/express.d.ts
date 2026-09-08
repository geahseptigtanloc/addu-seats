import type { User as PrismaUser } from '@prisma/client';

// Makes req.user (and passport.authenticate's callback `user` param)
// typed as our actual Prisma User everywhere, instead of the default {}.
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging requires this shape
    interface User extends PrismaUser {}
  }
}

export {};
