import dayjs from 'dayjs';
import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

const STANDARD_WORK_HOURS = 8;

export default eventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const username = query.username as string;
    if (!username) {
      return useResponseError('缺少用户名');
    }

    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();

    const records = await prismaClient.attendance.findMany({
      where: {
        username,
        punchIn: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    const stats = {
      attendanceDays: 0,
      lateDays: 0,
      earlyLeaveDays: 0,
      overtimeHours: 0,
      leaveDays: 0,
    };

    records.forEach((record) => {
      // 状态为1 (迟到) 或 3 (迟到+早退)
      if (record.status === 1 || record.status === 3) {
        stats.lateDays++;
      }
      // 状态为2 (早退) 或 3 (迟到+早退)
      if (record.status === 2 || record.status === 3) {
        stats.earlyLeaveDays++;
      }
      // 状态为5代表请假
      if (record.status === 5) {
        stats.leaveDays++;
      }

      if (record.punchIn && record.punchOut) {
        stats.attendanceDays++;
        const workHours = dayjs(record.punchOut).diff(
          dayjs(record.punchIn),
          'hour',
          true,
        );
        if (workHours > STANDARD_WORK_HOURS) {
          stats.overtimeHours += workHours - STANDARD_WORK_HOURS;
        }
      }
    });

    // 四舍五入加班时长到两位小数
    stats.overtimeHours = Math.round(stats.overtimeHours * 100) / 100;

    return useResponseSuccess(stats);
  } catch (error: any) {
    console.error('获取月度统计失败:', error);
    return useResponseError(error.message || '获取失败');
  }
});
