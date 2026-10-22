-- A payment can be a split of something bought from the list.
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "itemId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_itemId_idx" ON "Payment"("itemId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
