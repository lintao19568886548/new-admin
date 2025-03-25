// import { initDatabase } from '../../utils/db';
import { useResponseError, useResponseSuccess } from '../../utils/response';

export default defineEventHandler(async () => {
  try {
    // await initDatabase();
    return useResponseSuccess({
      message: '数据库初始化成功',
    });
  } catch (error) {
    return useResponseError(`数据库初始化失败: ${error.message}`);
  }
});
