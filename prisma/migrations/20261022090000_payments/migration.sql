-- Money owed between the two of them, ticked off as it's paid.
-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "billTotal" DOUBLE PRECISION,
    "owedBy" TEXT NOT NULL,
    "owedTo" TEXT NOT NULL,
    "billedOn" DATE NOT NULL,
    "paidOn" DATE,
    "paidBy" TEXT,
    "settlementId" TEXT,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_paidOn_idx" ON "Payment"("paidOn");

-- CreateIndex
CREATE INDEX "Payment_settlementId_idx" ON "Payment"("settlementId");
