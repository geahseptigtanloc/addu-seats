import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as reservationService from '../services/reservation.service';
import type { VoidScope } from '../services/reservation.service';
import { UnauthorizedError } from '../utils/AppError';

const createReservationSchema = z.object({
  qrToken: z.string().min(1),
});

const flaggedQuerySchema = z.object({
  status: z.enum(['active', 'all']).default('active'),
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
    const receipt = await reservationService.createReservation(
      { id: req.user.id, name: req.user.name, studentIdLast4: req.user.studentIdLast4 },
      parsed.data.qrToken,
    );
    res.status(201).json(receipt);
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

// Admin-only, enforced at the route level. Active flags by default;
// ?status=all adds recently resolved ones.
export async function getFlaggedReservations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = flaggedQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({ error: { message: "status must be 'active' or 'all'" } });
    return;
  }

  try {
    const reports = await reservationService.getFlaggedReservations(parsed.data.status === 'all');
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

export async function getCurrentReservation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  try {
    const reservation = await reservationService.getCurrentReservation(req.user.id);
    res.json({ reservation, qrToken: reservation.reservationId });
  } catch (err) {
    next(err);
  }
}

export async function getReservationDetails(
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
    const reservation = await reservationService.getReservationDetails(id);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function checkoutReservation(
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
    const reservation = await reservationService.checkoutReservation(req.user.id, id);
    res.json(reservation);
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
    const reservation = await reservationService.voidReservation(req.user.id, id);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

export async function confirmGhostSeat(
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
    const reservation = await reservationService.confirmGhostSeat(req.user.id, id);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
}

// Exactly one of `floor` or `allFloors: true`, so an omitted floor can never
// silently widen a one-floor void into a whole-building one.
const voidScopeSchema = z
  .object({
    building: z.string().min(1),
    floor: z.int32().optional(), // the database column's range; anything larger would 500
    allFloors: z.literal(true).optional(),
  })
  .refine((scope) => (scope.floor === undefined) !== (scope.allFloors === undefined), {
    message: 'Provide either floor or allFloors: true',
  });

function parseVoidScope(body: unknown): VoidScope | null {
  const parsed = voidScopeSchema.safeParse(body);

  if (!parsed.success) {
    return null;
  }

  const { building, floor } = parsed.data;
  return floor === undefined ? { building } : { building, floor };
}

const INVALID_VOID_SCOPE = 'Provide a building and either a floor or allFloors: true';

// Admin-only, enforced at the route level. Counts what a void-all would end.
export async function previewVoidAll(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const scope = parseVoidScope(req.body);

  if (!scope) {
    res.status(400).json({ error: { message: INVALID_VOID_SCOPE } });
    return;
  }

  try {
    const preview = await reservationService.previewVoidAll(scope);
    res.json({ building: scope.building, floor: scope.floor ?? null, ...preview });
  } catch (err) {
    next(err);
  }
}

// Admin-only, enforced at the route level.
export async function voidAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  const scope = parseVoidScope(req.body);

  if (!scope) {
    res.status(400).json({ error: { message: INVALID_VOID_SCOPE } });
    return;
  }

  try {
    const summary = await reservationService.voidAllInScope(req.user.id, scope);
    res.json({ building: scope.building, floor: scope.floor ?? null, ...summary });
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

export async function returnFromBreak(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  const parsed = createReservationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: { message: 'qrToken is required' } });
    return;
  }

  try {
    const seat = await reservationService.returnFromBreak(req.user.id, parsed.data.qrToken);
    res.json(seat);
  } catch (err) {
    next(err);
  }
}

export async function reverifyPresence(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  const parsed = createReservationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: { message: 'qrToken is required' } });
    return;
  }

  try {
    const outcome = await reservationService.reverifyPresence(req.user.id, parsed.data.qrToken);
    res.json({ outcome });
  } catch (err) {
    next(err);
  }
}
