import { PrismaClient } from "@prisma/client";

/** path สัมพันธ์กับโฟลเดอร์ prisma/ (ดู schema.prisma) */
const DEFAULT_DATABASE_URL = "file:./dev.db";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
