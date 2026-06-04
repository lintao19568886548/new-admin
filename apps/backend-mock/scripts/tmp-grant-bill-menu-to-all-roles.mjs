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
  const [billMenu] = await conn.query(`
    SELECT menu_id AS menuId, name, path, status, type
    FROM menu
    WHERE path = '/bill'
    LIMIT 1
  `);
  if (!billMenu) {
    throw new Error('Bill menu not found: /bill');
  }

  const menuId = Number(billMenu.menuId);

  const beforeMissing = await conn.query(
    `
      SELECT r.role_id AS roleId, r.name
      FROM role r
      LEFT JOIN role_menu rm
        ON rm.role_id = r.role_id
       AND rm.menu_id = ?
       AND rm.is_deleted = 0
      WHERE rm.id IS NULL
      ORDER BY r.role_id
    `,
    [menuId],
  );

  await conn.beginTransaction();
  try {
    await conn.query(
      `
        UPDATE role_menu rm
        SET rm.is_deleted = 0
        WHERE rm.menu_id = ?
      `,
      [menuId],
    );

    const rolesToInsert = await conn.query(
      `
        SELECT r.role_id AS roleId
        FROM role r
        LEFT JOIN role_menu rm
          ON rm.role_id = r.role_id
         AND rm.menu_id = ?
        WHERE rm.id IS NULL
        ORDER BY r.role_id
      `,
      [menuId],
    );

    for (const role of rolesToInsert) {
      await conn.query(
        `
          INSERT INTO role_menu (role_id, menu_id, is_deleted, create_time, update_time)
          VALUES (?, ?, 0, NOW(3), NOW(3))
        `,
        [Number(role.roleId), menuId],
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }

  const afterMissing = await conn.query(
    `
      SELECT r.role_id AS roleId, r.name
      FROM role r
      LEFT JOIN role_menu rm
        ON rm.role_id = r.role_id
       AND rm.menu_id = ?
       AND rm.is_deleted = 0
      WHERE rm.id IS NULL
      ORDER BY r.role_id
    `,
    [menuId],
  );

  const jiangLiang = await conn.query(
    `
      SELECT
        u.id,
        u.username,
        u.real_name AS realName,
        r.role_id AS roleId,
        r.name AS roleName,
        m.menu_id AS menuId,
        m.name AS menuName,
        m.path,
        rm.is_deleted AS isDeleted
      FROM user u
      INNER JOIN user_role ur ON ur.user_id = u.id
      INNER JOIN role r ON r.role_id = ur.role_id
      INNER JOIN role_menu rm ON rm.role_id = r.role_id
      INNER JOIN menu m ON m.menu_id = rm.menu_id
      WHERE u.real_name LIKE '%姜亮%'
        AND m.menu_id = ?
      ORDER BY u.id, r.role_id
    `,
    [menuId],
  );

  console.log(
    JSON.stringify(
      {
        afterMissing,
        beforeMissing,
        billMenu,
        jiangLiang,
      },
      replacer,
      2,
    ),
  );
} finally {
  await conn.end();
}
