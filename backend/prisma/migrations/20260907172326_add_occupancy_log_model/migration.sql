-- DropIndex
DROP INDEX "reservations_seat_id_idx";

-- DropIndex
DROP INDEX "reservations_user_id_idx";

-- CreateTable
CREATE TABLE "occupancy_logs" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "event_type" "OccupancyEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occupancy_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "occupancy_logs_reservation_id_idx" ON "occupancy_logs"("reservation_id");

-- AddForeignKey
ALTER TABLE "occupancy_logs" ADD CONSTRAINT "occupancy_logs_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
