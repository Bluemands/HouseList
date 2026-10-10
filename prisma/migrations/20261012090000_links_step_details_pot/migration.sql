-- Several links per item, replacing the single one (kept as the first link).
ALTER TABLE "Item" ADD COLUMN "links" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "Item" SET "links" = ARRAY["link"] WHERE "link" IS NOT NULL;
ALTER TABLE "Item" DROP COLUMN "link";

-- What finishing an item took from the pot. Until now everything finished
-- was charged its price, so that's what's recorded for existing items.
ALTER TABLE "Item" ADD COLUMN "potCharge" DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "Item" SET "potCharge" = COALESCE("actualPrice", 0) WHERE "status" = 'DONE';

-- The pot counts as in use once it or a monthly saving has been set.
ALTER TABLE "Settings" ADD COLUMN "potTracked" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Settings" SET "potTracked" = true WHERE "budgetAvailable" <> 0 OR "monthlySaving" <> 0;

-- Steps get their own cost, link and details.
ALTER TABLE "Step" ADD COLUMN "cost" DOUBLE PRECISION,
ADD COLUMN "link" TEXT,
ADD COLUMN "notes" TEXT;

-- Failed PIN attempts, for rate limiting the login.
CREATE TABLE "LoginThrottle" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);
