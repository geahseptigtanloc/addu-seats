-- The revised floor-3 sketch moves several chair positions and changes square
-- tables to one QR node each. Keep the old QR labels tied to their old locations
-- in reservation history, and retire them before seeding the revised labels.
INSERT INTO "occupancy_logs" ("id", "reservation_id", "event_type")
SELECT gen_random_uuid()::text, r."id", 'VACATED'::"OccupancyEventType"
FROM "reservations" r
JOIN "seats" s ON s."id" = r."seat_id"
WHERE s."current_qr_token" IN (
  SELECT 'seat:g3-' || kind || lpad(number::text, 3, '0')
  FROM (VALUES ('s', 76), ('t', 44), ('c', 22)) AS old_labels(kind, maximum)
  CROSS JOIN LATERAL generate_series(1, maximum) AS series(number)
)
  AND r."status" = 'CONFIRMED'
  AND s."status" IN ('OCCUPIED', 'OCCUPIED_ON_BREAK');

UPDATE "reservations"
SET "status" = 'VOIDED', "ended_at" = CURRENT_TIMESTAMP
WHERE "seat_id" IN (
  SELECT "id" FROM "seats"
  WHERE "current_qr_token" IN (
    SELECT 'seat:g3-' || kind || lpad(number::text, 3, '0')
    FROM (VALUES ('s', 76), ('t', 44), ('c', 22)) AS old_labels(kind, maximum)
    CROSS JOIN LATERAL generate_series(1, maximum) AS series(number)
  )
)
  AND "status" IN ('PENDING', 'CONFIRMED');

UPDATE "seats"
SET "status" = 'UNAVAILABLE', "updated_at" = CURRENT_TIMESTAMP
WHERE "current_qr_token" IN (
  SELECT 'seat:g3-' || kind || lpad(number::text, 3, '0')
  FROM (VALUES ('s', 76), ('t', 44), ('c', 22)) AS old_labels(kind, maximum)
  CROSS JOIN LATERAL generate_series(1, maximum) AS series(number)
);
