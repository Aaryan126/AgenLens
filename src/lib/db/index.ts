/**
 * Prisma client singleton for AgenLens.
 *
 * Uses the standard Next.js pattern to prevent multiple Prisma client
 * instances during hot module replacement in development.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton Prisma client instance.
 * In development, stores the client on globalThis to survive HMR.
 * In production, creates a single instance per process.
 */
export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
