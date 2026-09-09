import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as seatService from '../services/seat.service';
import * as reservationService from '../services/reservation.service';
import { UnauthorizedError } from '../utils/AppError';

const getSeatsQuerySchema = z.object({
  building: z.string().min(1).optional(),
  floor: z.coerce.number().int().optional(),
});

export async function getSeats(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = getSeatsQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: { message: 'Invalid query parameters' } });
    return;
  }

  try {
    const seats = await seatService.getSeats(parsed.data);
    res.json(seats);
  } catch (err) {
    next(err);
  }
}

export async function flagSeat(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  const { id } = req.params;

  if (typeof id !== 'string') {
    res.status(400).json({ error: { message: 'Invalid seat id' } });
    return;
  }

  try {
    await reservationService.flagSeat(req.user.id, id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
