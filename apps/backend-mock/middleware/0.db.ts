import { initDatabase } from '../utils/db';

export default defineNitroPlugin(async () => {
  console.log('开始初始化数据库...');
  try {
    // 在应用启动时初始化数据库
    await initDatabase();
    console.log('数据库连接已建立');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
});
