import type { OccupancyLog, OccupancyEventType } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateOccupancyLogInput {
  reservationId: string;
  eventType: OccupancyEventType;
}

export function create(data: CreateOccupancyLogInput): Promise<OccupancyLog> {
  return prisma.occupancyLog.create({ data });
}
