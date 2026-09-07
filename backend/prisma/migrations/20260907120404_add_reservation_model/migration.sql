-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seat_id" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_user_id_idx" ON "reservations"("user_id");

-- CreateIndex
CREATE INDEX "reservations_seat_id_idx" ON "reservations"("seat_id");

-- CreateIndex
CREATE INDEX "reservations_status_created_at_idx" ON "reservations"("status", "created_at");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
