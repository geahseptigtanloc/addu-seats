-- Bring reservations created before the seat-level PENDING state was added
-- into sync. The separate migration ensures the enum value is committed
-- before PostgreSQL uses it in an UPDATE.
UPDATE "seats" AS s
SET "status" = 'PENDING', "updated_at" = CURRENT_TIMESTAMP
FROM "reservations" AS r
WHERE r."seat_id" = s."id"
  AND r."status" = 'PENDING'
  AND s."status" = 'AVAILABLE';
