import { db } from '../../utils/db';
import { useResponseError, useResponseSuccess } from '../../utils/response';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = query.id;

  if (!id) {
    return useResponseError('用户ID是必填项');
  }

  try {
    // 获取用户详情
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = await stmt.get(id);

    if (!user) {
      return useResponseError('用户不存在');
    }

    return useResponseSuccess(user);
  } catch (error) {
    return useResponseError(`获取用户详情失败: ${error.message}`);
  }
});
