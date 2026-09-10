import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as analyticsService from '../services/analytics.service';

const utilizationQuerySchema = z.object({
  building: z.string().min(1).optional(),
  floor: z.coerce.number().int().optional(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export async function getUtilization(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = utilizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: 'Invalid query parameters — from and to are required dates' } });
    return;
  }

  try {
    const report = await analyticsService.getUtilization(parsed.data);
    res.json(report);
  } catch (err) {
    next(err);
  }
}
