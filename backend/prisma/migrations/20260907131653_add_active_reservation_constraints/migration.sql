-- This is an empty migration.

-- Enforce "one active reservation per seat" and "one active reservation
-- per user" at the database level. Prisma 6's schema syntax can't express
-- a partial (WHERE-clause) unique index, so this is hand-written here.
-- "Active" means PENDING or CONFIRMED, terminal statuses (CANCELLED,
-- FORFEITED, EVICTED, VOIDED, COMPLETED) are excluded, so a seat/user can
-- freely accumulate historical reservations without conflicting.

CREATE UNIQUE INDEX "reservations_one_active_per_seat"
  ON "reservations" ("seat_id")
  WHERE "status" IN ('PENDING', 'CONFIRMED');

CREATE UNIQUE INDEX "reservations_one_active_per_user"
  ON "reservations" ("user_id")
  WHERE "status" IN ('PENDING', 'CONFIRMED');