import type { Seat } from '@prisma/client';
import * as seatRepository from '../repositories/seat.repository';

export interface GetSeatsFilter {
  building?: string;
  floor?: number;
}

export function getSeats(filter: GetSeatsFilter): Promise<Seat[]> {
  return seatRepository.findMany(filter);
}
