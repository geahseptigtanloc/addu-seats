import type { Seat, SeatStatus } from '@prisma/client';
import * as seatRepository from '../repositories/seat.repository';
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

function getSeatLabel(seat: Seat): string {
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
  return seats.map(toPublicSeat);
}

export async function getScannedSeat(qrToken: string): Promise<PublicSeat> {
  const seat = await seatRepository.findByQrToken(qrToken);
  if (!seat) throw new NotFoundError('This seat QR code is invalid or no longer active');
  return toPublicSeat(seat);
}
