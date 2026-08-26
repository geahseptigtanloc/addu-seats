-- AlterEnum
ALTER TYPE "reservation_status" ADD VALUE 'pending_entry';

-- AlterEnum
ALTER TYPE "seat_status" ADD VALUE 'pending';

-- AlterEnum
ALTER TYPE "seat_type" ADD VALUE 'cubicle';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "entry_deadline" TIMESTAMP(6);

-- AlterTable
ALTER TABLE "seats" ADD COLUMN     "pos_x" DOUBLE PRECISION,
ADD COLUMN     "pos_y" DOUBLE PRECISION;
