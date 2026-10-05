-- A seat is pending during the five-minute front-desk entry window.
ALTER TYPE "SeatStatus" ADD VALUE IF NOT EXISTS 'PENDING' AFTER 'AVAILABLE';
