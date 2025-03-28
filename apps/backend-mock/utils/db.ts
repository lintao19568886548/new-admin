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
    connectionLimit: 10,
    maxIdle: 10,
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
