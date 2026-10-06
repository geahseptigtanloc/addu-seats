import type { Seat, SeatStatus } from '@prisma/client';
import * as seatRepository from '../repositories/seat.repository';
import { isRetiredSeatToken } from '../config/retiredSeats';
import { NotFoundError } from '../utils/AppError';

export interface GetSeatsFilter {
  building?: string;
  floor?: number;
}

export interface PublicSeat {
  id: string;
  label: string;
  building: string;
  floor: number;
  status: SeatStatus;
}

export function getSeatLabel(seat: Pick<Seat, 'currentQrToken' | 'id'>): string {
  return seat.currentQrToken.startsWith('seat:')
    ? seat.currentQrToken.slice('seat:'.length).toUpperCase()
    : seat.id;
}

function toPublicSeat(seat: Seat): PublicSeat {
  return {
    id: seat.id,
    label: getSeatLabel(seat),
    building: seat.building,
    floor: seat.floor,
    status: seat.status,
  };
}

export async function getSeats(filter: GetSeatsFilter): Promise<PublicSeat[]> {
  const seats = await seatRepository.findMany(filter);
  return seats.filter((seat) => !isRetiredSeatToken(seat.currentQrToken)).map(toPublicSeat);
}

export async function getScannedSeat(qrToken: string): Promise<PublicSeat> {
  if (isRetiredSeatToken(qrToken)) {
    throw new NotFoundError('This seat QR code is invalid or no longer active');
  }
  const seat = await seatRepository.findByQrToken(qrToken);
  if (!seat) throw new NotFoundError('This seat QR code is invalid or no longer active');
  return toPublicSeat(seat);
}
