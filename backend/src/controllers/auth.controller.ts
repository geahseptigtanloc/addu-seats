import type { Request, Response, NextFunction } from 'express';
import type { User } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env';
import { createExchangeCode, redeemExchangeCode } from '../services/auth.service';

export async function googleCallbackSuccess(
  user: User,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const code = await createExchangeCode(user);
    res.redirect(`${env.CORS_ORIGIN}/auth/callback?code=${code}`);
  } catch (err) {
    next(err);
  }
}

export function googleCallbackFailure(res: Response, reason: string): void {
  res.redirect(`${env.CORS_ORIGIN}/auth/callback?error=${encodeURIComponent(reason)}`);
}

const exchangeCodeSchema = z.object({ code: z.string().min(1) });

export async function exchangeCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = exchangeCodeSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: { message: 'code is required' } });
    return;
  }

  try {
    const token = await redeemExchangeCode(parsed.data.code);

    if (!token) {
      res.status(401).json({ error: { message: 'Invalid or expired code' } });
      return;
    }

    res.json({ token });
  } catch (err) {
    next(err);
  }
}
