-- CreateTable
CREATE TABLE "validation_events" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "event_type" "ValidationEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "validation_events_reservation_id_idx" ON "validation_events"("reservation_id");

-- AddForeignKey
ALTER TABLE "validation_events" ADD CONSTRAINT "validation_events_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
