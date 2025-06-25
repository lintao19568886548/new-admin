import dayjs from 'dayjs';
import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const startDate = query.startDate
      ? dayjs(query.startDate as string)
          .startOf('day')
          .toDate()
      : dayjs().subtract(7, 'day').startOf('day').toDate();
    const endDate = query.endDate
      ? dayjs(query.endDate as string)
          .endOf('day')
          .toDate()
      : dayjs().endOf('day').toDate();

    const where: any = {
      punchIn: {
        gte: startDate,
        lte: endDate,
      },
    };

    // 获取所有符合条件的记录，不进行分页
    const records = await prismaClient.attendance.findMany({
      where,
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
        username: record.username,
        date: dayjs(record.punchIn).format('YYYY-MM-DD'),
        punchIn: dayjs(record.punchIn).format('HH:mm:ss'),
        punchOut: record.punchOut
          ? dayjs(record.punchOut).format('HH:mm:ss')
          : '-',
        status: record.status,
        workHours,
        latitude: record.latitude,
        longitude: record.longitude,
      };
    });

    return useResponseSuccess(formattedItems);
  } catch (error: any) {
    console.error('导出考勤轨迹失败:', error);
    return useResponseError(error.message || '导出失败');
  }
});
