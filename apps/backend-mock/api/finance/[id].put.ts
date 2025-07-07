import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { images, ...financeData } = body;
  const financeId = Number.parseInt(event.context.params?.id ?? '');
  if (!financeId) {
    return useResponseError('financeId错误');
  }

  try {
    const updatedFinance = await prismaClient.$transaction(async (prisma) => {
      // 1. 删除旧图片
      await prisma.financeImage.deleteMany({
        where: { financeId },
      });

      // 2. 更新财务信息并创建新图片
      const result = await prisma.finance.update({
        where: { financeId },
        data: {
          ...financeData,
          transactionTime: financeData.transactionTime
            ? new Date(financeData.transactionTime)
            : undefined,
          ...(images && images.length > 0
            ? {
                images: {
                  create: images.map((img: string | { url: string }) => ({
                    url: typeof img === 'string' ? img : img.url,
                  })),
                },
              }
            : {}),
        },
        include: {
          images: true,
        },
      });
      return result;
    });

    return useResponseSuccess(updatedFinance);
  } catch (error) {
    console.error('更新财务数据失败:', error);
    return serverErrorResponse('更新财务数据失败', event);
  }
});
