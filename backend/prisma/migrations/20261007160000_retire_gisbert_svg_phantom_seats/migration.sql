-- Retire legacy seat tokens that have no matching green chair in the supplied
-- third- and fourth-floor SVG plans. Preserve historical rows and release any
-- active claims before the seat becomes unavailable.
INSERT INTO "occupancy_logs" ("id", "reservation_id", "event_type")
SELECT gen_random_uuid()::text, r."id", 'VACATED'::"OccupancyEventType"
FROM "reservations" r
JOIN "seats" s ON s."id" = r."seat_id"
WHERE (
  (s."current_qr_token" ~ '^seat:g3-c[0-9]{3}$' AND right(s."current_qr_token", 3)::int BETWEEN 1 AND 28)
  OR (s."current_qr_token" ~ '^seat:g4-c[0-9]{3}$' AND right(s."current_qr_token", 3)::int BETWEEN 19 AND 30)
)
  AND r."status" = 'CONFIRMED'
  AND s."status" = 'OCCUPIED';

UPDATE "reservations"
SET "status" = 'VOIDED', "ended_at" = CURRENT_TIMESTAMP
WHERE "seat_id" IN (
  SELECT "id"
  FROM "seats"
  WHERE (
    ("current_qr_token" ~ '^seat:g3-c[0-9]{3}$' AND right("current_qr_token", 3)::int BETWEEN 1 AND 28)
    OR ("current_qr_token" ~ '^seat:g4-c[0-9]{3}$' AND right("current_qr_token", 3)::int BETWEEN 19 AND 30)
  )
)
AND "status" IN ('PENDING', 'CONFIRMED');

UPDATE "seats"
SET "status" = 'UNAVAILABLE', "updated_at" = CURRENT_TIMESTAMP
WHERE (
  ("current_qr_token" ~ '^seat:g3-c[0-9]{3}$' AND right("current_qr_token", 3)::int BETWEEN 1 AND 28)
  OR ("current_qr_token" ~ '^seat:g4-c[0-9]{3}$' AND right("current_qr_token", 3)::int BETWEEN 19 AND 30)
);
