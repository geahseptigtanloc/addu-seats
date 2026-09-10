import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as analyticsService from '../services/analytics.service';

const analyticsQuerySchema = z.object({
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
  const parsed = analyticsQuerySchema.safeParse(req.query);

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

export async function getPeakHours(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = analyticsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: 'Invalid query parameters — from and to are required dates' } });
    return;
  }

  try {
    const report = await analyticsService.getPeakHours(parsed.data);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function getOutcomeBreakdown(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = analyticsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: 'Invalid query parameters — from and to are required dates' } });
    return;
  }

  try {
    const report = await analyticsService.getOutcomeBreakdown(parsed.data);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function getNoShowRate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = analyticsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: 'Invalid query parameters — from and to are required dates' } });
    return;
  }

  try {
    const report = await analyticsService.getNoShowRate(parsed.data);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function getAverageSessionLength(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = analyticsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: 'Invalid query parameters, from and to are required dates' } });
    return;
  }

  try {
    const report = await analyticsService.getAverageSessionLength(parsed.data);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function getBreakStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = analyticsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { message: 'Invalid query parameters — from and to are required dates' } });
    return;
  }

  try {
    const report = await analyticsService.getBreakStats(parsed.data);
    res.json(report);
  } catch (err) {
    next(err);
  }
}
