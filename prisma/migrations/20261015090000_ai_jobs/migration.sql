-- Questions for Claude about an item: queued by the app, answered by a worker
-- running Claude Code on someone's own computer.
-- CreateEnum
CREATE TYPE "AiJobKind" AS ENUM ('RESEARCH_ITEM', 'FIND_PRODUCT', 'ASK');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'ACCEPTED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "workerSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "kind" "AiJobKind" NOT NULL,
    "question" TEXT,
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiJob_status_createdAt_idx" ON "AiJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiJob_itemId_idx" ON "AiJob"("itemId");

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
