import { PrismaClient } from '@prisma/.prisma/client/index.js';

// 创建 PrismaClient 单例
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prismaClient;
