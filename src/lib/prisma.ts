import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// DATABASE_POOL_MAX lets local dev pin this to 1 — Prisma's local dev
// Postgres proxy (`prisma dev`) has been observed returning "prepared
// statement" protocol errors under >1 concurrent connection. Real Postgres
// (Neon, in production) doesn't need this; leave it unset there.
const poolMax = process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined;
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: poolMax });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
