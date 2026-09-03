import { PrismaClient } from "../generated/client";

// Unngår at det opprettes en ny PrismaClient (og dermed ny connection pool)
// for hver hot-reload i utvikling. Standard Next.js/Prisma-mønster.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Navn } from "../generated/client";
