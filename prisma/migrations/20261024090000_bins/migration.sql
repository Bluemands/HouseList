-- Bin day: the bins and when they go out.
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "bins" JSONB NOT NULL DEFAULT '[]';
