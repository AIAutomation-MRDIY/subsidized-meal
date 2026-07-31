import { PrismaClient } from '@prisma/client';

// With no DATABASE_URL configured, fall back to a local SQLite file so the
// app runs with zero setup. The path is relative to prisma/, matching where
// scripts/db-config.mjs writes the generated SQLite schema.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

// Reuse the client across hot reloads in dev so we don't exhaust connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
