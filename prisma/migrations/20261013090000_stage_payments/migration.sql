-- "Not charged" (null) is now distinct from "charged £0", so a price added
-- after ticking something off is still taken from the pot.
ALTER TABLE "Item" ALTER COLUMN "potCharge" DROP NOT NULL,
ALTER COLUMN "potCharge" DROP DEFAULT;
UPDATE "Item" SET "potCharge" = NULL
WHERE "status" <> 'DONE'
   OR ("potCharge" = 0 AND NOT COALESCE((SELECT "potTracked" FROM "Settings" WHERE "id" = 1), false));

-- Stage payments: a ticked step's cost leaves the pot, dated when it was ticked.
ALTER TABLE "Step" ADD COLUMN "doneAt" TIMESTAMP(3),
ADD COLUMN "potCharge" DOUBLE PRECISION;
