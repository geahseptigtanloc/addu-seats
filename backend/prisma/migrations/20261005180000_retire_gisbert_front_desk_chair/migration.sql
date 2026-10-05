-- G4-C030 is a front desk chair, not a reservable study node. Preserve its
-- historical seat row for reservation records while removing active claims.
INSERT INTO "occupancy_logs" ("id", "reservation_id", "event_type")
SELECT gen_random_uuid()::text, r."id", 'VACATED'::"OccupancyEventType"
FROM "reservations" r
JOIN "seats" s ON s."id" = r."seat_id"
WHERE s."current_qr_token" = 'seat:g4-c030'
  AND r."status" = 'CONFIRMED'
  AND s."status" = 'OCCUPIED';

UPDATE "reservations"
SET "status" = 'VOIDED', "ended_at" = CURRENT_TIMESTAMP
WHERE "seat_id" IN (
  SELECT "id" FROM "seats" WHERE "current_qr_token" = 'seat:g4-c030'
)
  AND "status" IN ('PENDING', 'CONFIRMED');

UPDATE "seats"
SET "status" = 'UNAVAILABLE', "updated_at" = CURRENT_TIMESTAMP
WHERE "current_qr_token" = 'seat:g4-c030';
