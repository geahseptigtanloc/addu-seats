import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as reservationService from '../services/reservation.service';
import { UnauthorizedError } from '../utils/AppError';

const createReservationSchema = z.object({
  qrToken: z.string().min(1),
});

export async function createReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = createReservationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: { message: 'qrToken is required' } });
    return;
  }

  // Guaranteed by requireAuth in normal use; checked explicitly rather
  // than asserted, matching requireRole's defensive pattern.
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  try {
    const reservation = await reservationService.createReservation(
      req.user.id,
      parsed.data.qrToken,
    );
    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function cancelReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  const { id } = req.params;

  if (typeof id !== 'string') {
    res.status(400).json({ error: { message: 'Invalid reservation id' } });
    return;
  }

  try {
    const reservation = await reservationService.cancelReservation(req.user.id, id);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

// Admin-only, enforced at the route level (requireRole)
export async function approveReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== 'string') {
    res.status(400).json({ error: { message: 'Invalid reservation id' } });
    return;
  }

  try {
    const reservation = await reservationService.approveReservation(id);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function getPendingQueue(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queue = await reservationService.getPendingQueue();
    res.json(queue);
  } catch (err) {
    next(err);
  }
}

// Admin-only, enforced at the route level.
export async function voidReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { id } = req.params;

  if (typeof id !== 'string') {
    res.status(400).json({ error: { message: 'Invalid reservation id' } });
    return;
  }

  try {
    const reservation = await reservationService.voidReservation(id);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function startBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  const { id } = req.params;

  if (typeof id !== 'string') {
    res.status(400).json({ error: { message: 'Invalid reservation id' } });
    return;
  }

  try {
    const seat = await reservationService.startBreak(req.user.id, id);
    res.json(seat);
  } catch (err) {
    next(err);
  }
}

export async function extendBreak(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  const { id } = req.params;

  if (typeof id !== 'string') {
    res.status(400).json({ error: { message: 'Invalid reservation id' } });
    return;
  }

  try {
    const result = await reservationService.extendBreak(req.user.id, id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
