-- C023-C028 belonged to the previous third-floor map and overlap six new
-- wall cubicles. Retire those old identities; the current cubicles use C053-C058.
INSERT INTO "occupancy_logs" ("id", "reservation_id", "event_type")
SELECT gen_random_uuid()::text, r."id", 'VACATED'::"OccupancyEventType"
FROM "reservations" r
JOIN "seats" s ON s."id" = r."seat_id"
WHERE s."current_qr_token" IN (
  SELECT 'seat:g3-c' || lpad(number::text, 3, '0')
  FROM generate_series(23, 28) AS series(number)
)
  AND r."status" = 'CONFIRMED'
  AND s."status" IN ('OCCUPIED', 'OCCUPIED_ON_BREAK');

UPDATE "reservations"
SET "status" = 'VOIDED', "ended_at" = CURRENT_TIMESTAMP
WHERE "seat_id" IN (
  SELECT "id" FROM "seats"
  WHERE "current_qr_token" IN (
    SELECT 'seat:g3-c' || lpad(number::text, 3, '0')
    FROM generate_series(23, 28) AS series(number)
  )
)
  AND "status" IN ('PENDING', 'CONFIRMED');

UPDATE "seats"
SET "status" = 'UNAVAILABLE', "updated_at" = CURRENT_TIMESTAMP
WHERE "current_qr_token" IN (
  SELECT 'seat:g3-c' || lpad(number::text, 3, '0')
  FROM generate_series(23, 28) AS series(number)
);
