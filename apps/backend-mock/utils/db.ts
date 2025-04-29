import type { Prisma } from '@prisma/.prisma/client/index.js';
import type { DefaultArgs } from '@prisma/.prisma/client/runtime/library';

import { PrismaClient } from '@prisma/.prisma/client/index.js';

export type PrismaTransactionClient = Omit<
  PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  '$connect' | '$disconnect' | '$extends' | '$on' | '$transaction' | '$use'
>;

// 创建 PrismaClient 单例
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prismaClient;
