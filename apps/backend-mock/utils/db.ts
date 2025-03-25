import fs from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabase } from 'db0';
import sqlite from 'db0/connectors/better-sqlite3';

// 获取当前文件的目录
const __dirname = fileURLToPath(new URL('.', import.meta.url));
// 获取项目根目录
const rootDir = join(__dirname, '..', '..');
// 数据库文件路径
const dbPath = join(rootDir, '.data', 'sqlite.db');
// 数据目录
const dataDir = join(rootDir, '.data');

console.log('数据库路径:', dbPath);
console.log('数据目录:', dataDir);

// 创建 SQLite 数据库客户端
export const db = createDatabase(
  sqlite({
    path: dbPath,
  }),
);

// 初始化数据库表
export async function initDatabase() {
  // 确保 .data 目录存在
  console.log('检查数据目录是否存在:', dataDir);

  if (fs.existsSync(dataDir)) {
    console.log('数据目录已存在');
  } else {
    console.log('数据目录不存在，正在创建...');
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('数据目录创建成功');
  }

  // 创建用户表示例
  console.log('开始创建用户表...');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库初始化完成');
}
