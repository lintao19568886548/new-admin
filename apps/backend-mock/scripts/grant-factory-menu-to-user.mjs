/**
 * 为指定手机号用户的角色授权"待租厂房"菜单
 *
 * 使用方式:
 *   cd apps/backend-mock
 *   node ./scripts/grant-factory-menu-to-user.mjs
 *
 * 先设置 previewOnly = true 预览，确认后改为 false 执行。
 */

import fs from 'node:fs';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const TARGET_PHONE = '18127933306';
const PREVIEW_ONLY = false; // 改为 true 可只预览不写入

const env = dotenv.parse(fs.readFileSync('.env', 'utf8'));
const url = new URL(env.DATABASE_URL);
const centerUrl = new URL(env.CENTER_DATABASE_URL);

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
const centerConn = await mariadb.createConnection(makeConnConfig(centerUrl));

function replacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

try {
  // 1. 查找目标用户（magic库，SMS登录时 username = 手机号）
  const users = await conn.query(
    `
    SELECT
      u.id,
      u.real_name AS realName,
      u.username,
      u.phone,
      u.status,
      GROUP_CONCAT(r.role_id ORDER BY r.role_id SEPARATOR ',') AS roleIds,
      GROUP_CONCAT(r.name ORDER BY r.role_id SEPARATOR ',') AS roleNames
    FROM user u
    LEFT JOIN user_role ur ON ur.user_id = u.id
    LEFT JOIN role r ON r.role_id = ur.role_id
    WHERE u.username = ? OR u.phone = ?
    GROUP BY u.id, u.real_name, u.username, u.phone, u.status
    `,
    [TARGET_PHONE, TARGET_PHONE],
  );

  if (users.length === 0) {
    throw new Error(`未找到手机号为 ${TARGET_PHONE} 的用户`);
  }

  const user = users[0];
  const roleIds = user.roleIds
    ? user.roleIds.split(',').map(Number).filter(Boolean)
    : [];

  console.log('\n[1] 目标用户:');
  console.log(JSON.stringify(user, replacer, 2));

  if (roleIds.length === 0) {
    throw new Error('该用户没有关联角色，无法授权');
  }

  // 2. 查找"待租厂房"相关菜单
  const factoryMenus = await conn.query(`
    SELECT
      m.menu_id AS menuId,
      m.name,
      m.path,
      m.component,
      m.auth_code AS authCode,
      m.pid,
      m.status,
      m.type,
      mm.title,
      mm.icon,
      mm.\`order\` AS sortOrder
    FROM menu m
    LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
    WHERE m.path = '/rental/factory'
       OR m.path LIKE '/rental/factory%'
       OR m.component LIKE '%factory%'
       OR mm.title LIKE '%待租%'
       OR mm.title LIKE '%厂房%'
    ORDER BY COALESCE(m.pid, 0), m.menu_id
  `);

  console.log('\n[2] 找到的待租厂房相关菜单:');
  console.log(JSON.stringify(factoryMenus, replacer, 2));

  if (factoryMenus.length === 0) {
    throw new Error('数据库中未找到待租厂房相关菜单，请确认菜单已创建');
  }

  // 3. 检查当前授权状态
  const menuIds = factoryMenus.map((m) => Number(m.menuId));
  const placeholders = menuIds.map(() => '?').join(',');

  const currentPerms = await conn.query(
    `
    SELECT
      r.role_id AS roleId,
      r.name AS roleName,
      m.menu_id AS menuId,
      m.path,
      mm.title,
      rm.is_deleted AS isDeleted
    FROM role r
    LEFT JOIN role_menu rm ON rm.role_id = r.role_id AND rm.menu_id IN (${placeholders})
    LEFT JOIN menu m ON m.menu_id = rm.menu_id
    LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
    WHERE r.role_id IN (${roleIds.map(() => '?').join(',')})
    ORDER BY r.role_id, m.menu_id
    `,
    [...menuIds, ...roleIds],
  );

  console.log('\n[3] 当前角色菜单权限状态:');
  console.log(JSON.stringify(currentPerms, replacer, 2));

  if (PREVIEW_ONLY) {
    console.log('\n[预览模式] 以上为预览，未写入数据库。将 PREVIEW_ONLY 改为 false 后再执行。');
    process.exit(0);
  }

  // 4. 执行授权
  await conn.beginTransaction();
  let insertCount = 0;
  let updateCount = 0;

  try {
    for (const menuId of menuIds) {
      for (const roleId of roleIds) {
        // 检查是否已存在记录
        const [existing] = await conn.query(
          `SELECT id, is_deleted FROM role_menu WHERE role_id = ? AND menu_id = ? LIMIT 1`,
          [roleId, menuId],
        );

        if (existing) {
          if (existing.is_deleted) {
            // 恢复软删除的记录
            await conn.query(
              `UPDATE role_menu SET is_deleted = 0, update_time = NOW(3) WHERE id = ?`,
              [existing.id],
            );
            updateCount++;
            console.log(`  [恢复] role_id=${roleId}, menu_id=${menuId}`);
          } else {
            console.log(`  [已存在] role_id=${roleId}, menu_id=${menuId}，跳过`);
          }
        } else {
          // 插入新记录
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
  } catch (error) {
    await conn.rollback();
    throw error;
  }

  // 5. 验证结果
  const afterPerms = await conn.query(
    `
    SELECT
      r.role_id AS roleId,
      r.name AS roleName,
      m.menu_id AS menuId,
      m.path,
      mm.title,
      rm.is_deleted AS isDeleted
    FROM role r
    INNER JOIN role_menu rm ON rm.role_id = r.role_id AND rm.menu_id IN (${placeholders}) AND rm.is_deleted = 0
    INNER JOIN menu m ON m.menu_id = rm.menu_id
    LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
    WHERE r.role_id IN (${roleIds.map(() => '?').join(',')})
    ORDER BY r.role_id, m.menu_id
    `,
    [...menuIds, ...roleIds],
  );

  console.log('\n[4] 授权完成，当前有效权限:');
  console.log(JSON.stringify(afterPerms, replacer, 2));
  console.log(`\n共新增 ${insertCount} 条，恢复 ${updateCount} 条。`);
  console.log(`\n用户 ${user.realName}（${TARGET_PHONE}）的角色已获得待租厂房菜单访问权限。`);
} finally {
  await conn.end();
}
