import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  const billId = Number.parseInt(event.context.params.id);
  if (!billId) {
    return useResponseError('billId错误');
  }

  try {
    // 使用事务处理删除操作
    const result = await prismaClient.$transaction(async (prisma) => {
      // 1. 先删除关联的电费记录
      await prisma.eleBill.deleteMany({
        where: {
          billId,
        },
      });

      // 2. 删除关联的水费记录
      await prisma.waterBill.deleteMany({
        where: {
          billId,
        },
      });

      // 3. 最后删除账单本身
      return await prisma.amountBill.delete({
        where: {
          billId,
        },
      });
    });

    console.log('删除账单成功:', result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return useResponseError('删除账单失败', 500);
  }
});
