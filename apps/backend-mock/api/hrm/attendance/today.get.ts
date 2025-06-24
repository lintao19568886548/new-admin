import dayjs from 'dayjs';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (_event) => {
  try {
    const startOfToday = dayjs().startOf('day').toDate();
    const endOfToday = dayjs().endOf('day').toDate();

    const todayRecord = await prismaClient.attendance.findFirst({
      where: {
        // 在实际应用中，这里应该是当前登录用户的ID
        userId: 1,
        punchIn: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      orderBy: {
        punchIn: 'desc',
      },
    });

    return useResponseSuccess(todayRecord);
  } catch (error: any) {
    console.error('获取今日打卡记录失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
