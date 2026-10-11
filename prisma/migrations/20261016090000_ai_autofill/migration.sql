-- Jobs queued from quick add fill their item in rather than suggesting.
-- AlterTable
ALTER TABLE "AiJob" ADD COLUMN     "autofill" BOOLEAN NOT NULL DEFAULT false;
