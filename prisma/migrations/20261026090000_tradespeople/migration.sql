-- The tradespeople book.
-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('YES', 'NOT_SURE', 'NO');

-- CreateTable
CREATE TABLE "Tradesperson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "verdict" "Verdict",
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tradesperson_pkey" PRIMARY KEY ("id")
);
