import dayjs from 'dayjs';
import { readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const { punchTime, longitude, latitude, username } = await readBody(event);
    console.log('punchTime', punchTime);
    console.log('longitude', longitude);
    console.log('latitude', latitude);

    if (
      !punchTime ||
      longitude === undefined ||
      latitude === undefined ||
      !username
    ) {
      return useResponseError('缺少必要的参数');
    }

    // 检查当天是否已经有打卡记录
    const startOfToday = dayjs(punchTime).startOf('day').toDate();
    const endOfToday = dayjs(punchTime).endOf('day').toDate();
    const existingRecord = await prismaClient.attendance.findFirst({
      where: {
        username,
        punchIn: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    if (existingRecord) {
      return useResponseError('今天已经打过上班卡了');
    }

    // 假设标准上班时间是 09:00:00
    const standardPunchInTime = dayjs(punchTime).startOf('day').hour(9);
    const isLate = dayjs(punchTime).isAfter(standardPunchInTime);

    const newAttendance = await prismaClient.attendance.create({
      data: {
        punchIn: new Date(punchTime),
        longitude,
        latitude,
        status: isLate ? 1 : 0, // 0: 正常, 1: 迟到
        username,
      },
    });
    console.log('newAttendance', newAttendance);

    return useResponseSuccess(newAttendance, '打卡成功');
  } catch (error: any) {
    console.error('创建打卡记录失败:', error);
    return useResponseError(error.message || '创建失败');
  }
});
