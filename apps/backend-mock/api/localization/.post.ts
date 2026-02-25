import { eventHandler, readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return useResponseError('未登录或登录已过期', { statusCode: 401 });
  }

  try {
    const { punchTime, status, longitude, latitude } = await readBody(event);

    if (
      !punchTime ||
      status === undefined ||
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
            id: userinfo.id,
          },
        },
        username: userinfo.username,
      },
    });

    return useResponseSuccess(localization, '创建成功');
  } catch (error: any) {
    console.error('创建打卡记录失败:', error);
    return useResponseError(error.message || '创建失败');
  }
});
