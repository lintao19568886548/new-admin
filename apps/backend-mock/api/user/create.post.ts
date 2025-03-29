import { db } from '../../utils/db';
import { useResponseError, useResponseSuccess } from '../../utils/response';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body.username || !body.email) {
    return useResponseError('用户名和邮箱是必填项');
  }

  try {
    // 插入新用户
    const stmt = db.prepare('INSERT INTO user (username, email) VALUES (?, ?)');
    const result = await stmt.run(body.username, body.email);

    return useResponseSuccess({
      success: true,
      message: '用户创建成功',
      id: result.lastInsertRowid,
    });
  } catch (error) {
    return useResponseError(`创建用户失败: ${error.message}`);
  }
});
