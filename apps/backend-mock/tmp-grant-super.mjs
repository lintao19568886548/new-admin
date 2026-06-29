import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: '123456',
  database: 'magic',
  connectTimeout: 10000,
});

const phone = '18684982159';

const [[user]] = await conn.query('SELECT id, real_name, phone FROM `user` WHERE phone = ?', [phone]);
if (!user) { console.log('用户不存在'); process.exit(1); }
console.log('找到用户:', user.id, user.real_name, user.phone);

const [[superRole]] = await conn.query("SELECT role_id, name FROM `role` WHERE name = 'Super' LIMIT 1");
if (!superRole) { console.log('Super 角色不存在'); process.exit(1); }
console.log('找到角色:', superRole.role_id, superRole.name);

const [[existing]] = await conn.query(
  'SELECT id FROM user_role WHERE user_id = ? AND role_id = ?',
  [user.id, superRole.role_id]
);
if (existing) { console.log('该用户已经是超级管理员'); await conn.end(); process.exit(0); }

await conn.query('INSERT INTO user_role (user_id, role_id) VALUES (?, ?)', [user.id, superRole.role_id]);
console.log('成功授予超级管理员权限');

await conn.end();
