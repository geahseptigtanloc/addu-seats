-- Phase 3 migration: staff role, break/flag fields, updated validation event types

-- 1. Add 'staff' to user_role enum
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'staff';

-- 2. Replace validation_event_type enum values
-- We need to recreate the enum since PostgreSQL doesn't support renaming enum values easily
-- First, create the new enum
CREATE TYPE "validation_event_type_new" AS ENUM (
  'front_desk_approved',
  'front_desk_rejected',
  'break_started',
  'break_extended',
  'break_returned',
  'break_expired',
  'flagged',
  'flag_resolved'
);

-- Drop the old column default and alter the column type
ALTER TABLE "validation_events" ALTER COLUMN "event_type" TYPE "validation_event_type_new" 
  USING (
    CASE "event_type"::text
      WHEN 'front_desk_verify' THEN 'front_desk_approved'
      WHEN 'break_start' THEN 'break_started'
      WHEN 'break_return' THEN 'break_returned'
      WHEN 'flag_raised' THEN 'flagged'
      WHEN 'flag_resolved' THEN 'flag_resolved'
      WHEN 'forfeited' THEN 'break_expired'
      ELSE 'front_desk_approved'
    END
  )::"validation_event_type_new";

-- Drop old enum and rename new one
DROP TYPE "validation_event_type";
ALTER TYPE "validation_event_type_new" RENAME TO "validation_event_type";

-- 3. Add break/flag columns to reservations
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "break_started_at" TIMESTAMP(6);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "break_deadline" TIMESTAMP(6);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "break_minutes_used" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cooldown_until" TIMESTAMP(6);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "flagged_at" TIMESTAMP(6);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "flagged_by" UUID;

-- 4. Add note column to validation_events
ALTER TABLE "validation_events" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- 5. Add foreign key for flagged_by
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_flagged_by_fkey" 
  FOREIGN KEY ("flagged_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
