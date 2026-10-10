-- The overhaul: items become jobs *or* purchases, cost turns optional, and
-- items pick up who/when/steps. User-created lists collapse into a loose
-- project tag on each item so no grouping is lost.

-- Status vocabulary now covers jobs as well as purchases.
ALTER TYPE "Status" RENAME VALUE 'WISHLIST' TO 'TODO';
ALTER TYPE "Status" RENAME VALUE 'PLANNED' TO 'DOING';
ALTER TYPE "Status" RENAME VALUE 'BOUGHT' TO 'DONE';
ALTER TABLE "Item" ALTER COLUMN "status" SET DEFAULT 'TODO';

CREATE TYPE "Kind" AS ENUM ('TASK', 'BUY');

-- Everything that exists today was logged as a purchase, so it backfills as
-- BUY; new rows default to TASK.
ALTER TABLE "Item"
  ADD COLUMN "kind" "Kind" NOT NULL DEFAULT 'BUY',
  ADD COLUMN "estimateMax" DOUBLE PRECISION,
  ADD COLUMN "isQuote" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "assignee" TEXT,
  ADD COLUMN "dueDate" DATE,
  ADD COLUMN "project" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "completedBy" TEXT;
ALTER TABLE "Item" ALTER COLUMN "kind" SET DEFAULT 'TASK';
ALTER TABLE "Item" ALTER COLUMN "estimatedPrice" DROP NOT NULL;
ALTER TABLE "Item" ALTER COLUMN "room" SET DEFAULT 'WHOLE_HOUSE';
ALTER TABLE "Item" ALTER COLUMN "priority" SET DEFAULT 'WOULD_LIKE';

-- Things that read as jobs rather than purchases.
UPDATE "Item" SET "kind" = 'TASK'
WHERE "title" ~* '^(fix|paint|repair|install|fit|clean|call|book|sort|clear|remove|replace|hang|build|assemble|decorate|service|seal|tile|plaster|rewire|sand|treat)\M'
   OR "title" ~* '\m(renovation|repair|damp|decorating|refit)\M';

UPDATE "Item" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE';

-- Lists → project tag. The first list was the catch-all, so its items stay
-- untagged; every other list's name carries over.
UPDATE "Item" i SET "project" = l."name"
FROM "List" l
WHERE i."listId" = l."id"
  AND l."id" <> (SELECT "id" FROM "List" ORDER BY "position" ASC, "createdAt" ASC LIMIT 1);

ALTER TABLE "Item" DROP CONSTRAINT "Item_listId_fkey";
DROP INDEX "Item_listId_idx";
ALTER TABLE "Item" DROP COLUMN "listId";
DROP TABLE "List";

CREATE TABLE "Step" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Step_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Step_itemId_idx" ON "Step"("itemId");
ALTER TABLE "Step"
  ADD CONSTRAINT "Step_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Settings"
  ADD COLUMN "monthlySaving" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "members" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "movedInOn" DATE;

-- Everyone who has added something so far is a member.
UPDATE "Settings" SET "members" = ARRAY(SELECT DISTINCT "addedBy" FROM "Item" ORDER BY 1);
