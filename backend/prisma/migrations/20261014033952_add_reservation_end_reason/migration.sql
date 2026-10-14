-- CreateEnum
CREATE TYPE "ReservationEndReason" AS ENUM ('STAFF_VOID', 'GHOST_CONFIRMED', 'BULK_VOID', 'MIDNIGHT_SWEEP');

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "end_reason" "ReservationEndReason",
ADD COLUMN     "ended_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_ended_by_id_fkey" FOREIGN KEY ("ended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
