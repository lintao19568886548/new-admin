import { db } from '../../utils/db';
import { useResponseSuccess } from '../../utils/response';

export default defineEventHandler(async () => {
  try {
    // 获取所有用户
    const stmt = db.prepare('SELECT * FROM user');
    const users = await stmt.all();

    return useResponseSuccess({
      items: users,
      total: users.length,
    });
  } catch (error) {
    return {
      code: -1,
      data: null,
      error: error.message,
      message: '获取用户列表失败',
    };
  }
});
