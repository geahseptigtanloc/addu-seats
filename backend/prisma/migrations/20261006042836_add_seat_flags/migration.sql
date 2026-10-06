-- CreateEnum
CREATE TYPE "SeatFlagStatus" AS ENUM ('ACTIVE', 'REVERIFIED', 'EVICTED', 'VOIDED', 'CHECKED_OUT');

-- CreateTable
CREATE TABLE "seat_flags" (
    "id" TEXT NOT NULL,
    "seat_id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "flagged_by_id" TEXT NOT NULL,
    "status" "SeatFlagStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "seat_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seat_flags_status_expires_at_idx" ON "seat_flags"("status", "expires_at");

-- CreateIndex
CREATE INDEX "seat_flags_flagged_by_id_created_at_idx" ON "seat_flags"("flagged_by_id", "created_at");

-- CreateIndex
CREATE INDEX "seat_flags_reservation_id_idx" ON "seat_flags"("reservation_id");

-- AddForeignKey
ALTER TABLE "seat_flags" ADD CONSTRAINT "seat_flags_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_flags" ADD CONSTRAINT "seat_flags_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_flags" ADD CONSTRAINT "seat_flags_flagged_by_id_fkey" FOREIGN KEY ("flagged_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One active flag per seat. Hand-written because Prisma's schema syntax
-- can't express a WHERE clause on an index.
CREATE UNIQUE INDEX "seat_flags_one_active_per_seat"
ON "seat_flags" ("seat_id")
WHERE "status" = 'ACTIVE';

-- An open flag has no resolution time; a resolved one always has one.
ALTER TABLE "seat_flags"
ADD CONSTRAINT "seat_flags_resolved_at_matches_status"
CHECK (("status" = 'ACTIVE') = ("resolved_at" IS NULL));
