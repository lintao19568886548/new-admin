import dayjs from 'dayjs';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

const STANDARD_WORK_HOURS = 8;

export default eventHandler(async (_event) => {
  try {
    const startOfMonth = dayjs().startOf('month').toDate();
    const endOfMonth = dayjs().endOf('month').toDate();

    const records = await prismaClient.attendance.findMany({
      where: {
        userId: 1, // 硬编码用户ID
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
    };

    records.forEach((record) => {
      // 状态为1代表迟到
      if (record.status === 1) {
        stats.lateDays++;
      }
      // 状态为2代表早退
      if (record.status === 2) {
        stats.earlyLeaveDays++;
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
