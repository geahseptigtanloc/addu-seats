import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as seatService from '../services/seat.service';

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
