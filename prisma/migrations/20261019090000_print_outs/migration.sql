-- Print-outs: lists printed to tick off on paper, kept as printed.
-- CreateTable
CREATE TABLE "PrintOut" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrintOut_createdAt_idx" ON "PrintOut"("createdAt");
