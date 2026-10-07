-- Floor 3 now assigns a separate QR to each chair at the four square tables.
-- Retire the temporary shared-table tokens without reusing their identities.
INSERT INTO "occupancy_logs" ("id", "reservation_id", "event_type")
SELECT gen_random_uuid()::text, r."id", 'VACATED'::"OccupancyEventType"
FROM "reservations" r
JOIN "seats" s ON s."id" = r."seat_id"
WHERE s."current_qr_token" IN ('seat:g3-t045', 'seat:g3-t046', 'seat:g3-t047', 'seat:g3-t048')
  AND r."status" = 'CONFIRMED'
  AND s."status" IN ('OCCUPIED', 'OCCUPIED_ON_BREAK');

UPDATE "reservations"
SET "status" = 'VOIDED', "ended_at" = CURRENT_TIMESTAMP
WHERE "seat_id" IN (
  SELECT "id" FROM "seats"
  WHERE "current_qr_token" IN ('seat:g3-t045', 'seat:g3-t046', 'seat:g3-t047', 'seat:g3-t048')
)
  AND "status" IN ('PENDING', 'CONFIRMED');

UPDATE "seats"
SET "status" = 'UNAVAILABLE', "updated_at" = CURRENT_TIMESTAMP
WHERE "current_qr_token" IN ('seat:g3-t045', 'seat:g3-t046', 'seat:g3-t047', 'seat:g3-t048');
