import dayjs from 'dayjs';
import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const { username } = getQuery(event);

    if (!username) {
      return useResponseError('缺少用户名');
    }

    const startOfToday = dayjs().startOf('day').toDate();
    const endOfToday = dayjs().endOf('day').toDate();

    const todayRecord = await prismaClient.attendance.findFirst({
      where: {
        username: username as string,
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
