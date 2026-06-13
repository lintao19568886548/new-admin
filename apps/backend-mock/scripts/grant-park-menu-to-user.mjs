/**
 * 为 18127933306 的角色授权"园区管理"菜单（/system/park）
 *
 * 使用方式:
 *   cd apps/backend-mock
 *   node ./scripts/grant-park-menu-to-user.mjs
 */

import fs from 'node:fs';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const TARGET_PHONE = '18127933306';

const env = dotenv.parse(fs.readFileSync('.env', 'utf8'));
const url = new URL(env.DATABASE_URL);

function makeConnConfig(u) {
  return {
    database: u.pathname.replace(/^\//, ''),
    dateStrings: true,
    host: u.hostname,
    password: decodeURIComponent(u.password),
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
  };
}

const conn = await mariadb.createConnection(makeConnConfig(url));

function replacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

try {
  // 1. 查用户及角色
  const users = await conn.query(
    `SELECT u.id, u.real_name AS realName,
            GROUP_CONCAT(r.role_id ORDER BY r.role_id SEPARATOR ',') AS roleIds,
            GROUP_CONCAT(r.name   ORDER BY r.role_id SEPARATOR ',') AS roleNames
     FROM user u
     LEFT JOIN user_role ur ON ur.user_id = u.id
     LEFT JOIN role r ON r.role_id = ur.role_id
     WHERE u.username = ? OR u.phone = ?
     GROUP BY u.id, u.real_name`,
    [TARGET_PHONE, TARGET_PHONE],
  );

  if (!users.length) throw new Error(`未找到用户 ${TARGET_PHONE}`);

  const user = users[0];
  const roleIds = user.roleIds ? user.roleIds.split(',').map(Number).filter(Boolean) : [];
  console.log('\n[1] 用户:', JSON.stringify(user, replacer, 2));

  // 2. 查园区管理相关菜单（/system/park 及其父级 System 目录）
  const parkMenus = await conn.query(`
    SELECT m.menu_id AS menuId, m.name, m.path, m.pid, m.type, mm.title
    FROM menu m
    LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
    WHERE m.path IN ('/system/park', '/system')
       OR m.name  IN ('SystemPark', 'System')
       OR m.path LIKE '/system/park%'
    ORDER BY COALESCE(m.pid, 0), m.menu_id
  `);

  console.log('\n[2] 找到的园区管理菜单:', JSON.stringify(parkMenus, replacer, 2));

  if (!parkMenus.length) throw new Error('数据库中未找到园区管理菜单');

  const menuIds = parkMenus.map((m) => Number(m.menuId));

  // 3. 授权
  await conn.beginTransaction();
  let insertCount = 0;
  let updateCount = 0;

  try {
    for (const menuId of menuIds) {
      for (const roleId of roleIds) {
        const [existing] = await conn.query(
          `SELECT id, is_deleted FROM role_menu WHERE role_id = ? AND menu_id = ? LIMIT 1`,
          [roleId, menuId],
        );

        if (existing) {
          if (existing.is_deleted) {
            await conn.query(
              `UPDATE role_menu SET is_deleted = 0, update_time = NOW(3) WHERE id = ?`,
              [existing.id],
            );
            updateCount++;
            console.log(`  [恢复] role_id=${roleId}, menu_id=${menuId}`);
          } else {
            console.log(`  [已存在] role_id=${roleId}, menu_id=${menuId}`);
          }
        } else {
          await conn.query(
            `INSERT INTO role_menu (role_id, menu_id, is_deleted, create_time, update_time) VALUES (?, ?, 0, NOW(3), NOW(3))`,
            [roleId, menuId],
          );
          insertCount++;
          console.log(`  [新增] role_id=${roleId}, menu_id=${menuId}`);
        }
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  }

  console.log(`\n完成：新增 ${insertCount} 条，恢复 ${updateCount} 条。`);
  console.log(`用户 ${user.realName}（${TARGET_PHONE}）已获得园区管理访问权限。`);
} finally {
  await conn.end();
}
