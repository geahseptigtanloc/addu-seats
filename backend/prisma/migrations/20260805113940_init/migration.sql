-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('student', 'admin');

-- CreateEnum
CREATE TYPE "building" AS ENUM ('gisbert', 'miguel_pro');

-- CreateEnum
CREATE TYPE "seat_type" AS ENUM ('individual', 'table_node');

-- CreateEnum
CREATE TYPE "seat_status" AS ENUM ('available', 'pending_verification', 'occupied', 'on_break', 'disabled');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('pending', 'active', 'on_break', 'completed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "validation_event_type" AS ENUM ('front_desk_verify', 'break_start', 'break_return', 'flag_raised', 'flag_resolved', 'forfeited');

-- CreateEnum
CREATE TYPE "occupancy_event_type" AS ENUM ('occupied', 'vacated', 'break_start', 'break_end');

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'student',
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "addu_id_last4" VARCHAR(4),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "seats" (
    "seat_id" UUID NOT NULL,
    "building" "building" NOT NULL,
    "floor" INTEGER NOT NULL,
    "seat_type" "seat_type" NOT NULL,
    "status" "seat_status" NOT NULL DEFAULT 'available',
    "current_qr_token" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("seat_id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "reservation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seat_id" UUID NOT NULL,
    "status" "reservation_status" NOT NULL DEFAULT 'pending',
    "reserved_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(6),
    "checked_out_at" TIMESTAMP(6),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "validation_events" (
    "event_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "admin_id" UUID,
    "event_type" "validation_event_type" NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "occupancy_logs" (
    "log_id" UUID NOT NULL,
    "seat_id" UUID NOT NULL,
    "event_type" "occupancy_event_type" NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occupancy_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "seats_status_idx" ON "seats"("status");

-- CreateIndex
CREATE INDEX "seats_building_floor_idx" ON "seats"("building", "floor");

-- CreateIndex
CREATE INDEX "reservations_user_id_idx" ON "reservations"("user_id");

-- CreateIndex
CREATE INDEX "reservations_seat_id_idx" ON "reservations"("seat_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "validation_events_reservation_id_idx" ON "validation_events"("reservation_id");

-- CreateIndex
CREATE INDEX "occupancy_logs_seat_id_idx" ON "occupancy_logs"("seat_id");

-- CreateIndex
CREATE INDEX "occupancy_logs_timestamp_idx" ON "occupancy_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("seat_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_events" ADD CONSTRAINT "validation_events_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("reservation_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_events" ADD CONSTRAINT "validation_events_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancy_logs" ADD CONSTRAINT "occupancy_logs_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("seat_id") ON DELETE RESTRICT ON UPDATE CASCADE;
