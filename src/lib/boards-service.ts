import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type {
  boardCreateSchema,
  boardUpdateSchema,
  pieceCreateSchema,
  pieceToItemSchema,
  pieceUpdateSchema,
} from "@/lib/validation";
import { toBoardDTO, toPieceDTO } from "@/lib/data";
import { createItem } from "@/lib/items-service";
import { copyPhoto, removePhotos, savePhoto } from "@/lib/photo-store";
import { PIECES_MAX, PIECE_WIDTH, heightFor } from "@/lib/boards";

// Planning boards (lib/boards.ts has the layout rules). A board's own
// updatedAt moves whenever anything on it changes, so the boards most
// recently worked on come first.

const touch = (boardId: string) => prisma.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } });

export async function createBoard(data: z.output<typeof boardCreateSchema>) {
  const board = await prisma.board.create({ data: { ...data, room: data.room ?? null }, include: { pieces: true } });
  return toBoardDTO(board);
}

/** The board as it is now, or null if it's gone. */
export async function updateBoard(id: string, data: z.output<typeof boardUpdateSchema>) {
  const { count } = await prisma.board.updateMany({ where: { id }, data });
  if (!count) return null;
  const board = await prisma.board.findUnique({ where: { id }, include: { pieces: true } });
  return board ? toBoardDTO(board) : null;
}

export async function deleteBoard(id: string) {
  const pieces = await prisma.boardPiece.findMany({ where: { boardId: id, imageId: { not: null } }, select: { imageId: true } });
  // deleteMany so both phones deleting it at once is a no-op.
  await prisma.board.deleteMany({ where: { id } });
  await removePhotos(pieces.map((p) => p.imageId!));
}

export class BoardError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Puts a piece on a board, with its picture when it has one. */
export async function addPiece(
  boardId: string,
  data: z.output<typeof pieceCreateSchema>,
  image: { full: Uint8Array; thumb: Uint8Array } | null,
) {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { _count: { select: { pieces: true } } } });
  if (!board) throw new BoardError("Someone else deleted this board", 404);
  if (board._count.pieces >= PIECES_MAX) throw new BoardError(`That board is full (${PIECES_MAX} things). Start another?`);
  if (data.kind === "ITEM") {
    if (!data.itemId || !(await prisma.item.count({ where: { id: data.itemId } }))) {
      throw new BoardError("That's no longer on the list", 404);
    }
  }
  const top = await prisma.boardPiece.aggregate({ where: { boardId }, _max: { z: true } });

  const imageId = image ? randomUUID() : null;
  if (image) await savePhoto(imageId!, image);
  try {
    const piece = await prisma.boardPiece.create({
      data: {
        ...data,
        boardId,
        imageId,
        aspect: image ? (data.aspect ?? null) : null,
        itemId: data.kind === "ITEM" ? data.itemId : null,
        z: (top._max.z ?? 0) + 1,
      },
    });
    await touch(boardId);
    return toPieceDTO(piece);
  } catch (err) {
    if (imageId) await removePhotos([imageId]);
    throw err;
  }
}

/** The piece as it is now, or null if it's gone. */
export async function updatePiece(id: string, data: z.output<typeof pieceUpdateSchema>) {
  const piece = await prisma.boardPiece.update({ where: { id }, data }).catch(() => null);
  if (!piece) return null;
  await touch(piece.boardId);
  return toPieceDTO(piece);
}

export async function deletePiece(id: string) {
  const piece = await prisma.boardPiece.findUnique({ where: { id }, select: { imageId: true, boardId: true } });
  if (!piece) return;
  await prisma.boardPiece.deleteMany({ where: { id } });
  if (piece.imageId) await removePhotos([piece.imageId]);
  await touch(piece.boardId).catch(() => undefined);
}

/**
 * An idea on a board becomes a real item: named, with its price and link,
 * and its picture as the item's first photo. The piece then shows the item
 * itself, so ticking it off on the board ticks it off on the list.
 */
export async function pieceToItem(id: string, data: z.output<typeof pieceToItemSchema>) {
  const piece = await prisma.boardPiece.findUnique({ where: { id } });
  if (!piece) throw new BoardError("Someone else deleted this", 404);
  if (piece.itemId) throw new BoardError("That's already on the list");

  // A note's first line names it; the rest of the note comes along as notes.
  const noteRest =
    piece.kind === "NOTE" && piece.text ? piece.text.trim().split("\n").slice(1).join("\n").trim() || null : null;
  const item = await createItem({
    ...data,
    estimatedPrice: piece.price ?? undefined,
    links: piece.url ? [piece.url] : undefined,
    notes: noteRest ?? undefined,
  });

  if (piece.imageId) {
    const photoId = randomUUID();
    try {
      await copyPhoto(piece.imageId, photoId);
      // Shrunk on the phone to 1600 on the longer side; the shape is what matters.
      const aspect = piece.aspect ?? 1;
      await prisma.photo.create({
        data: {
          id: photoId,
          itemId: item.id,
          width: aspect >= 1 ? 1600 : Math.round(1600 * aspect),
          height: aspect >= 1 ? Math.round(1600 / aspect) : 1600,
          addedBy: data.addedBy,
        },
      });
    } catch (err) {
      // The item stands without its picture rather than failing.
      console.error("Couldn't copy a board picture to its item", err);
      await removePhotos([photoId]);
    }
  }

  // It's drawn as an item card from now on, which needs an item card's width.
  const w = Math.max(piece.w, PIECE_WIDTH.ITEM.start);
  const updated = await prisma.boardPiece.update({
    where: { id },
    data: { kind: "ITEM", itemId: item.id, w, h: heightFor("ITEM", w, piece.imageId ? piece.aspect : null) },
  });
  await touch(piece.boardId);
  return { piece: toPieceDTO(updated), itemId: item.id };
}
