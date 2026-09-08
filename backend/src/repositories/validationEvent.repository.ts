import type { ValidationEvent, ValidationEventType } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateValidationEventInput {
  reservationId: string;
  eventType: ValidationEventType;
}

export function create(data: CreateValidationEventInput): Promise<ValidationEvent> {
  return prisma.validationEvent.create({ data });
}
