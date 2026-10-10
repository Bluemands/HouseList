-- Introduce top-level lists ("sections") above the existing flat item table.
-- Every item that already exists belongs to one starter list, so the shelf
-- looks exactly as it did before this ran.

CREATE TABLE "List" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "List_position_idx" ON "List"("position");

-- Seed the list every pre-existing item is adopted into. Fixed id (not a cuid)
-- so this migration is deterministic and re-readable.
INSERT INTO "List" ("id", "name", "position") VALUES ('lst_house_starter', 'The House List', 0);

-- Two-step add: nullable first so existing rows can be backfilled, then locked
-- to NOT NULL once every item has a home.
ALTER TABLE "Item" ADD COLUMN "listId" TEXT;
UPDATE "Item" SET "listId" = 'lst_house_starter' WHERE "listId" IS NULL;
ALTER TABLE "Item" ALTER COLUMN "listId" SET NOT NULL;

CREATE INDEX "Item_listId_idx" ON "Item"("listId");

ALTER TABLE "Item"
  ADD CONSTRAINT "Item_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
