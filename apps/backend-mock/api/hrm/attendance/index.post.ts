import dayjs from 'dayjs';
import { readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const { punchTime, longitude, latitude } = await readBody(event);
    console.log('punchTime', punchTime);
    console.log('longitude', longitude);
    console.log('latitude', latitude);

    if (!punchTime || longitude === undefined || latitude === undefined) {
      return useResponseError('缺少必要的参数');
    }

    // 假设标准上班时间是 09:00:00
    const standardPunchInTime = dayjs(punchTime).startOf('day').hour(9);
    const isLate = dayjs(punchTime).isAfter(standardPunchInTime);

    // 使用 upsert 确保测试用户存在，避免因重复创建或ID问题导致的错误
    const testUsername = 'testuser_1';
    const user = await prismaClient.user.upsert({
      where: { username: testUsername },
      update: {},
      create: {
        realName: '测试用户',
        username: testUsername,
        password: 'password', // 在Mock环境中密码无所谓
      },
    });

    const newAttendance = await prismaClient.attendance.create({
      data: {
        punchIn: new Date(punchTime),
        longitude,
        latitude,
        status: isLate ? 1 : 0, // 0: 正常, 1: 迟到
        userId: user.id,
      },
    });
    console.log('newAttendance', newAttendance);

    return useResponseSuccess(newAttendance, '打卡成功');
  } catch (error: any) {
    console.error('创建打卡记录失败:', error);
    return useResponseError(error.message || '创建失败');
  }
});
