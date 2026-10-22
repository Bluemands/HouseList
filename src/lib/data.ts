import { prisma } from "@/lib/prisma";
import type { AiJob, Board, BoardPiece, Comment, Item, Payment, Photo, Quote, Settings, Step } from "@/generated/prisma/client";
import { stepCostsKey, stepsTotal, type ItemDTO, type SettingsDTO } from "@/lib/types";
import { OPEN_JOB_STATUSES, aiResultSchema, type AiJobDTO } from "@/lib/ai";
import type { BoardDTO, PieceDTO } from "@/lib/boards";
import type { PaymentDTO } from "@/lib/payments";

const toDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function fromDay(day: string | null | undefined): Date | null | undefined {
  if (day === undefined) return undefined;
  return day === null ? null : new Date(`${day}T00:00:00.000Z`);
}

type StepInput = { text: string; done?: boolean; cost?: number | null; link?: string | null; notes?: string | null };

/** A list of steps as rows to create, in the order given. */
export function stepRows(steps: StepInput[]) {
  return steps.map((s, position) => ({
    text: s.text,
    done: s.done ?? false,
    cost: s.cost ?? null,
    link: s.link ?? null,
    notes: s.notes ?? null,
    position,
  }));
}

/**
 * When steps carry costs, the item's estimate is their total — set whenever
 * those costs change. Ticking or reordering steps leaves the estimate alone,
 * so a quote chosen for the whole job isn't quietly replaced.
 */
export function estimateFromSteps(steps: StepInput[] | undefined, before?: { cost: number | null }[]) {
  if (!steps || (before && stepCostsKey(steps) === stepCostsKey(before))) return {};
  const total = stepsTotal(steps);
  return total == null ? {} : { estimatedPrice: total, estimateMax: null };
}

/** Everything an item carries, for every query that returns one. */
export const ITEM_INCLUDE = { steps: true, quotes: true, comments: true, photos: true } as const;

type FullItem = Item & { steps: Step[]; quotes?: Quote[]; comments?: Comment[]; photos?: Photo[] };

export function toItemDTO(item: FullItem): ItemDTO {
  const { quotes = [], comments = [], photos = [], ...rest } = item;
  return {
    ...rest,
    dueDate: toDay(item.dueDate),
    warrantyUntil: toDay(item.warrantyUntil),
    completedAt: item.completedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    steps: [...item.steps]
      .sort((a, b) => a.position - b.position)
      .map(({ id, text, done, cost, link, notes, potCharge, doneAt }) => ({
        id,
        text,
        done,
        cost,
        link,
        notes,
        potCharge,
        doneAt: doneAt?.toISOString() ?? null,
      })),
    quotes: [...quotes]
      .sort((a, b) => a.amount - b.amount)
      .map(({ id, from, amount, note, chosen, addedBy, createdAt }) => ({
        id,
        from,
        amount,
        note,
        chosen,
        addedBy,
        createdAt: createdAt.toISOString(),
      })),
    comments: [...comments]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ id, author, text, createdAt }) => ({ id, author, text, createdAt: createdAt.toISOString() })),
    photos: [...photos]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ id, width, height, addedBy, createdAt }) => ({ id, width, height, addedBy, createdAt: createdAt.toISOString() })),
  };
}

export function toPieceDTO(piece: BoardPiece): PieceDTO {
  const { id, boardId, kind, x, y, w, h, z, imageId, aspect, itemId, url, title, price, site, text, color, addedBy } = piece;
  return {
    ...{ id, boardId, kind, x, y, w, h, z, imageId, aspect, itemId, url, title, price, site, text, color, addedBy },
    createdAt: piece.createdAt.toISOString(),
  };
}

export function toBoardDTO(board: Board & { pieces: BoardPiece[] }): BoardDTO {
  return {
    id: board.id,
    name: board.name,
    room: board.room,
    createdBy: board.createdBy,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    pieces: board.pieces.map(toPieceDTO),
  };
}

export async function getBoards(): Promise<BoardDTO[]> {
  const boards = await prisma.board.findMany({ include: { pieces: true }, orderBy: { updatedAt: "desc" } });
  return boards.map(toBoardDTO);
}

export function toPaymentDTO(payment: Payment): PaymentDTO {
  return {
    id: payment.id,
    description: payment.description,
    amount: payment.amount,
    billTotal: payment.billTotal,
    owedBy: payment.owedBy,
    owedTo: payment.owedTo,
    billedOn: toDay(payment.billedOn)!,
    paidOn: toDay(payment.paidOn),
    paidBy: payment.paidBy,
    settlementId: payment.settlementId,
    addedBy: payment.addedBy,
    createdAt: payment.createdAt.toISOString(),
  };
}

/** Every payment there's been: a couple of bills a month stays small. */
export async function getPayments(): Promise<PaymentDTO[]> {
  const payments = await prisma.payment.findMany({ orderBy: [{ billedOn: "desc" }, { createdAt: "desc" }] });
  return payments.map(toPaymentDTO);
}

export function toSettingsDTO(settings: Settings): SettingsDTO {
  return {
    budgetAvailable: settings.budgetAvailable,
    potTracked: settings.potTracked,
    monthlySaving: settings.monthlySaving,
    members: settings.members ?? [],
    movedInOn: toDay(settings.movedInOn),
    lastPaydayOn: toDay(settings.lastPaydayOn),
    lastPaydayBy: settings.lastPaydayBy,
    workerSeenAt: settings.workerSeenAt?.toISOString() ?? null,
  };
}

export function toAiJobDTO(job: AiJob): AiJobDTO {
  // Stored results were validated on the way in; parse again so a shape
  // change never reaches the UI half-formed.
  const result = job.result == null ? null : aiResultSchema.safeParse(job.result);
  return {
    id: job.id,
    itemId: job.itemId,
    kind: job.kind,
    question: job.question,
    autofill: job.autofill,
    status: job.status,
    applied: job.undo != null,
    result: result?.success ? result.data : null,
    error: job.error,
    requestedBy: job.requestedBy,
    claimedAt: job.claimedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  };
}

/** Questions for Claude that still need someone: waiting, working, answered or failed. */
export async function getOpenJobs(): Promise<AiJobDTO[]> {
  const jobs = await prisma.aiJob.findMany({
    where: { status: { in: [...OPEN_JOB_STATUSES] } },
    orderBy: { createdAt: "desc" },
  });
  return jobs.map(toAiJobDTO);
}

/** Names are matched without regard to case: "connor" is Connor. */
export const isMember = (members: string[], name: string) =>
  members.some((m) => m.toLowerCase() === name.toLowerCase());

export function getSettings() {
  return prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export type State = {
  items: ItemDTO[];
  settings: SettingsDTO;
  jobs: AiJobDTO[];
  boards: BoardDTO[];
  payments: PaymentDTO[];
};

export async function getState(): Promise<State> {
  // Sequential, not Promise.all: concurrent queries over the same adapter
  // pool have triggered "prepared statement" protocol errors against the
  // local Prisma Postgres dev server.
  const items = await prisma.item.findMany({ include: ITEM_INCLUDE, orderBy: { createdAt: "desc" } });
  const settings = await getSettings();
  const jobs = await getOpenJobs();
  const boards = await getBoards();
  const payments = await getPayments();
  return { items: items.map(toItemDTO), settings: toSettingsDTO(settings), jobs, boards, payments };
}
