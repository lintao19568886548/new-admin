import dayjs from 'dayjs';
import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const page = Number.parseInt(query.page as string) || 1;
    const pageSize = Number.parseInt(query.pageSize as string) || 10;
    const startDate = query.startDate
      ? dayjs(query.startDate as string)
          .startOf('day')
          .toDate()
      : undefined;
    const endDate = query.endDate
      ? dayjs(query.endDate as string)
          .endOf('day')
          .toDate()
      : undefined;

    // 首先，找到固定的测试用户
    const testUser = await prismaClient.user.findUnique({
      where: { username: 'testuser_1' },
    });

    // 如果找不到测试用户，直接返回空，因为不可能有任何关联的考勤记录
    if (!testUser) {
      return useResponseSuccess({
        items: [],
        total: 0,
      });
    }

    const where: any = {
      userId: testUser.id,
    };

    if (startDate && endDate) {
      where.punchIn = {
        gte: startDate,
        lte: endDate,
      };
    }

    const total = await prismaClient.attendance.count({ where });
    const records = await prismaClient.attendance.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        punchIn: 'desc',
      },
    });

    const formattedItems = records.map((record) => {
      let workHours = 0;
      if (record.punchIn && record.punchOut) {
        const workDuration = dayjs(record.punchOut).diff(
          dayjs(record.punchIn),
          'hour',
          true,
        );
        workHours = Math.round(workDuration * 100) / 100;
      }

      return {
        key: record.attendanceId,
        date: dayjs(record.punchIn).format('YYYY-MM-DD'),
        punchIn: dayjs(record.punchIn).format('HH:mm:ss'),
        punchOut: record.punchOut
          ? dayjs(record.punchOut).format('HH:mm:ss')
          : '-',
        status: record.status,
        workHours,
      };
    });

    return useResponseSuccess({
      items: formattedItems,
      total,
    });
  } catch (error: any) {
    console.error('获取考勤列表失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
