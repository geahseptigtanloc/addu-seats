import type { Seat } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface FindSeatsFilter {
  building?: string;
  floor?: number;
}

// Ordered by createdAt so the seat map renders in a stable, consistent
// order across requests.
export function findMany(filter: FindSeatsFilter = {}): Promise<Seat[]> {
  return prisma.seat.findMany({
    where: {
      ...(filter.building !== undefined && { building: filter.building }),
      ...(filter.floor !== undefined && { floor: filter.floor }),
    },
    orderBy: { createdAt: 'asc' },
  });
}

export function findByQrToken(token: string): Promise<Seat | null> {
  return prisma.seat.findUnique({ where: { currentQrToken: token } });
}
