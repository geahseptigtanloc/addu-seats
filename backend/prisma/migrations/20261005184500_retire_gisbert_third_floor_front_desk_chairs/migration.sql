-- G3-C020 through G3-C022 are front desk chairs, not reservable study nodes.
-- Preserve their historical seat rows while removing any active claims.
INSERT INTO "occupancy_logs" ("id", "reservation_id", "event_type")
SELECT gen_random_uuid()::text, r."id", 'VACATED'::"OccupancyEventType"
FROM "reservations" r
JOIN "seats" s ON s."id" = r."seat_id"
WHERE s."current_qr_token" IN ('seat:g3-c020', 'seat:g3-c021', 'seat:g3-c022')
  AND r."status" = 'CONFIRMED'
  AND s."status" = 'OCCUPIED';

UPDATE "reservations"
SET "status" = 'VOIDED', "ended_at" = CURRENT_TIMESTAMP
WHERE "seat_id" IN (
  SELECT "id"
  FROM "seats"
  WHERE "current_qr_token" IN ('seat:g3-c020', 'seat:g3-c021', 'seat:g3-c022')
)
  AND "status" IN ('PENDING', 'CONFIRMED');

UPDATE "seats"
SET "status" = 'UNAVAILABLE', "updated_at" = CURRENT_TIMESTAMP
WHERE "current_qr_token" IN ('seat:g3-c020', 'seat:g3-c021', 'seat:g3-c022');
