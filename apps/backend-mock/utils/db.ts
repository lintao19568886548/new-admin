import { PrismaClient } from '@prisma/client';
import { createDatabase } from 'db0';
import mysql from 'db0/connectors/mysql2';

// 创建 MySQL 数据库客户端
export const db = createDatabase(
  mysql({
    // 基本连接信息
    user: 'root',
    password: '123456',
    host: '192.168.110.29',
    database: 'magic',

    // 连接池设置
    connectionLimit: 13,
    maxIdle: 13,
    idleTimeout: 30_000,
    queueLimit: 0,
    waitForConnections: true,

    // 网络优化
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,

    // 时区设置
    timezone: 'local',
  }),
);

// 创建 PrismaClient 单例
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prismaClient =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prismaClient;
