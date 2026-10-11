-- "Improve with Claude": a job that revises an existing item in place, with
-- what it changed kept so it can be undone.
-- AlterEnum
ALTER TYPE "AiJobKind" ADD VALUE 'IMPROVE';

-- AlterTable
ALTER TABLE "AiJob" ADD COLUMN     "undo" JSONB;
