-- Repeating jobs (boiler service, smoke alarm tests, gutters…).
CREATE TYPE "Repeat" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'TWICE_YEARLY', 'YEARLY');

ALTER TABLE "Item"
  ADD COLUMN "repeat" "Repeat",
  ADD COLUMN "spawnedFromId" TEXT;
