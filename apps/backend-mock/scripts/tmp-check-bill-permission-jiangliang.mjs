import fs from 'node:fs';

import dotenv from 'dotenv';
import mariadb from 'mariadb';

const env = dotenv.parse(fs.readFileSync('.env', 'utf8'));
const url = new URL(env.DATABASE_URL);

const conn = await mariadb.createConnection({
  database: url.pathname.replace(/^\//, '') || 'magic',
  dateStrings: true,
  host: url.hostname,
  password: decodeURIComponent(url.password),
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
});

function replacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

try {
  const users = await conn.query(`
    SELECT
      u.id,
      u.username,
      u.real_name AS realName,
      u.phone,
      u.status,
      u.park_id AS parkId,
      p.park_name AS parkName,
      GROUP_CONCAT(r.role_id ORDER BY r.role_id SEPARATOR ',') AS roleIds,
      GROUP_CONCAT(r.name ORDER BY r.role_id SEPARATOR ',') AS roles
    FROM user u
    LEFT JOIN park p ON p.park_id = u.park_id
    LEFT JOIN user_role ur ON ur.user_id = u.id
    LEFT JOIN role r ON r.role_id = ur.role_id
    WHERE u.real_name LIKE '%姜亮%'
       OR u.username LIKE '%姜亮%'
       OR u.phone LIKE '%姜亮%'
    GROUP BY u.id, u.username, u.real_name, u.phone, u.status, u.park_id, p.park_name
    ORDER BY u.id
  `);

  const billMenus = await conn.query(`
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
    WHERE m.path = '/bill'
       OR m.path LIKE '/bill/%'
       OR m.component LIKE '%bill%'
       OR m.name LIKE '%Bill%'
       OR mm.title LIKE '%账单%'
    ORDER BY COALESCE(m.pid, 0), m.menu_id
  `);

  const roleMenus = await conn.query(`
    SELECT
      r.role_id AS roleId,
      r.name AS roleName,
      r.status AS roleStatus,
      m.menu_id AS menuId,
      m.name AS menuName,
      m.path,
      mm.title,
      rm.is_deleted AS isDeleted
    FROM role r
    LEFT JOIN role_menu rm ON rm.role_id = r.role_id
    LEFT JOIN menu m ON m.menu_id = rm.menu_id
    LEFT JOIN menu_meta mm ON mm.menu_id = m.menu_id
    WHERE m.path = '/bill'
       OR m.path LIKE '/bill/%'
       OR m.component LIKE '%bill%'
       OR m.name LIKE '%Bill%'
       OR mm.title LIKE '%账单%'
    ORDER BY r.role_id, m.menu_id
  `);

  const roles = await conn.query(`
    SELECT
      r.role_id AS roleId,
      r.name,
      r.status,
      r.parent_id AS parentId,
      COUNT(rm.id) AS menuCount
    FROM role r
    LEFT JOIN role_menu rm ON rm.role_id = r.role_id AND rm.is_deleted = 0
    GROUP BY r.role_id, r.name, r.status, r.parent_id
    ORDER BY r.role_id
  `);

  console.log(
    JSON.stringify({ billMenus, roleMenus, roles, users }, replacer, 2),
  );
} finally {
  await conn.end();
}
