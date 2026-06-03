import { prismaClient } from '~/utils/db';
import {
  forbiddenFinanceParkResponse,
  hasFinanceParkAccess,
} from '~/utils/finance-permission';
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
      const existingFinance = await prisma.finance.findFirst({
        select: {
          parkId: true,
        },
        where: {
          financeId,
          isDeleted: false,
        },
      });
      if (!existingFinance) {
        throw new Error('FINANCE_NOT_FOUND');
      }
      if (!hasFinanceParkAccess(userinfo, existingFinance.parkId)) {
        throw new Error('FINANCE_FORBIDDEN');
      }
      if (
        financeData.parkId !== undefined &&
        !hasFinanceParkAccess(userinfo, Number(financeData.parkId))
      ) {
        throw new Error('FINANCE_FORBIDDEN');
      }

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
    if (error instanceof Error && error.message === 'FINANCE_NOT_FOUND') {
      return useResponseError('未找到财务记录', 404);
    }
    if (error instanceof Error && error.message === 'FINANCE_FORBIDDEN') {
      return forbiddenFinanceParkResponse(event);
    }
    console.error('更新财务数据失败:', error);
    return serverErrorResponse('更新财务数据失败', event);
  }
});
