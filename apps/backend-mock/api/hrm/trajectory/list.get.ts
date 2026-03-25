import dayjs from 'dayjs';
import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const page = Number.parseInt((query.page as string) || '1');
    const pageSize = Number.parseInt((query.pageSize as string) || '10');
    const employeeName =
      typeof query.employeeName === 'string' ? query.employeeName.trim() : '';

    // 如果未提供日期范围，则默认为所有历史数据
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

    if (employeeName) {
      where.OR = [
        {
          username: {
            contains: employeeName,
          },
        },
        {
          user: {
            is: {
              realName: {
                contains: employeeName,
              },
            },
          },
        },
        {
          user: {
            is: {
              username: {
                contains: employeeName,
              },
            },
          },
        },
      ];
    }

    const total = await prismaClient.attendance.count({ where });
    const records = await prismaClient.attendance.findMany({
      include: {
        user: {
          select: {
            realName: true,
            username: true,
          },
        },
      },
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
        username:
          record.user?.realName ||
          record.user?.username ||
          record.username ||
          '未知用户',
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

    return useResponseSuccess({
      items: formattedItems,
      total,
    });
  } catch (error: any) {
    console.error('获取考勤轨迹列表失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
