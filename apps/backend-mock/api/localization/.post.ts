import { eventHandler, readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const { punchTime, username, status, userId, longitude, latitude } =
      await readBody(event);

    if (
      !punchTime ||
      !username ||
      status === undefined ||
      !userId ||
      longitude === undefined ||
      latitude === undefined
    ) {
      return useResponseError('缺少必要的参数，包括经纬度', {
        statusCode: 400,
      });
    }

    const localization = await prismaClient.localization.create({
      data: {
        latitude,
        longitude,
        punchTime: new Date(punchTime),
        status: Number(status),
        user: {
          connect: {
            id: userId,
          },
        },
        username,
      },
    });

    return useResponseSuccess(localization, '创建成功');
  } catch (error: any) {
    console.error('创建打卡记录失败:', error);
    return useResponseError(error.message || '创建失败');
  }
});
