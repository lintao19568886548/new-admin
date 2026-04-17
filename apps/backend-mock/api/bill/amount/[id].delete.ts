import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

import { deleteAmountBillsByIds } from './delete-utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const billId = Number.parseInt(event.context.params.id);
  if (!billId) {
    return useResponseError('billId错误');
  }

  try {
    const bill = await prismaClient.amountBill.findUnique({
      where: {
        billId,
      },
    });

    const result = await prismaClient.$transaction(async (prisma) => {
      await deleteAmountBillsByIds(prisma, [billId]);
      return bill;
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除账单失败:', error);
    return serverErrorResponse(`删除账单失败`, event);
  }
});
