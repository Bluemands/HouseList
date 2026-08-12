-- CreateEnum
CREATE TYPE "Room" AS ENUM ('KITCHEN', 'BATHROOM', 'LIVING_ROOM', 'BEDROOM', 'GARDEN', 'EXTERIOR', 'WHOLE_HOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('MUST_HAVE', 'WOULD_LIKE', 'SOMEDAY');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('WISHLIST', 'PLANNED', 'BOUGHT');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "room" "Room" NOT NULL,
    "estimatedPrice" DOUBLE PRECISION NOT NULL,
    "actualPrice" DOUBLE PRECISION,
    "priority" "Priority" NOT NULL,
    "link" TEXT,
    "notes" TEXT,
    "addedBy" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'WISHLIST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "budgetAvailable" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE INDEX "Item_priority_idx" ON "Item"("priority");

-- CreateIndex
CREATE INDEX "Item_room_idx" ON "Item"("room");
