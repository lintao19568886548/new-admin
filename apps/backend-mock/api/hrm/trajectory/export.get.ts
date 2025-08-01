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
      : dayjs('2020-01-01').startOf('day').toDate(); // 设置为足够早的日期以覆盖所有历史数据
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

    // 获取所有符合条件的记录，并包含用户信息和园区信息
    const records = await prismaClient.attendance.findMany({
      where,
      include: {
        user: {
          select: {
            username: true,
            realName: true,
            park: {
              select: {
                parkName: true,
              },
            },
          },
        },
      },
      orderBy: {
        punchIn: 'desc',
      },
    });

    // 按园区分组
    const groupedByPark: Record<string, any[]> = {};
    for (const record of records) {
      const parkName = record.user?.park?.parkName || '未分配园区';
      if (!groupedByPark[parkName]) {
        groupedByPark[parkName] = [];
      }

      let workHours = 0;
      if (record.punchIn && record.punchOut) {
        const workDuration = dayjs(record.punchOut).diff(
          dayjs(record.punchIn),
          'hour',
          true,
        );
        workHours = Math.round(workDuration * 100) / 100;
      }

      const formattedRecord = {
        key: record.attendanceId,
        username: record.user?.realName || record.user?.username || '未知用户',
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

      groupedByPark[parkName].push(formattedRecord);
    }

    return useResponseSuccess(groupedByPark);
  } catch (error: any) {
    console.error('导出考勤轨迹失败:', error);
    return useResponseError(error.message || '导出失败');
  }
});
