-- Who last added the monthly saving to the pot, and when.

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "lastPaydayBy" TEXT,
ADD COLUMN     "lastPaydayOn" DATE;
