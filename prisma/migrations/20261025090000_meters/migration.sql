-- Meter readings, and the day of the month to be reminded to take them.
-- CreateEnum
CREATE TYPE "Meter" AS ENUM ('GAS', 'ELECTRIC', 'WATER');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "meterDay" INTEGER;

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "meter" "Meter" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "takenOn" DATE NOT NULL,
    "photoId" TEXT,
    "takenBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeterReading_meter_takenOn_idx" ON "MeterReading"("meter", "takenOn");
