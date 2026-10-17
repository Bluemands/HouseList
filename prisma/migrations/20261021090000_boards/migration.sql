-- Planning boards and the pieces on them.
-- CreateEnum
CREATE TYPE "PieceKind" AS ENUM ('PHOTO', 'LINK', 'ITEM', 'NOTE', 'SWATCH');

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room" "Room",
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardPiece" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "kind" "PieceKind" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    "z" INTEGER NOT NULL DEFAULT 0,
    "imageId" TEXT,
    "aspect" DOUBLE PRECISION,
    "itemId" TEXT,
    "url" TEXT,
    "title" TEXT,
    "price" DOUBLE PRECISION,
    "site" TEXT,
    "text" TEXT,
    "color" TEXT,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardPiece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardPiece_boardId_idx" ON "BoardPiece"("boardId");

-- CreateIndex
CREATE INDEX "BoardPiece_itemId_idx" ON "BoardPiece"("itemId");

-- AddForeignKey
ALTER TABLE "BoardPiece" ADD CONSTRAINT "BoardPiece_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardPiece" ADD CONSTRAINT "BoardPiece_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
