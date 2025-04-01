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

// 数据库连接诊断函数
export async function checkDatabaseConnection() {
  try {
    // 测试 db0 MySQL 连接
    const dbResult = await db.sql`SELECT 1 as testConnection`.then(
      (result) => result.rows?.[0] || null,
    );
    const mysqlConnected = !!dbResult;

    // 测试 Prisma 连接
    let prismaConnected = false;
    try {
      await prismaClient.$queryRaw`SELECT 1 as testConnection`;
      prismaConnected = true;
    } catch (prismaError) {
      console.error('Prisma 数据库连接测试失败:', prismaError);
    }

    return {
      mysql: {
        connected: mysqlConnected,
        config: {
          host: '192.168.110.29',
          database: 'magic',
          user: 'root',
        },
      },
      prisma: {
        connected: prismaConnected,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('数据库连接诊断错误:', error);
    return {
      mysql: {
        connected: false,
        error: error.message || '未知错误',
        config: {
          host: '192.168.110.29',
          database: 'magic',
          user: 'root',
        },
      },
      prisma: {
        connected: false,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
