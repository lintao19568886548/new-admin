import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

import { deleteAmountBillsByIds } from './delete-utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const bills = await prismaClient.amountBill.findMany({
      select: {
        billId: true,
      },
    });

    const billIds = bills.map((item) => item.billId);

    const result = await prismaClient.$transaction(async (prisma) => {
      return await deleteAmountBillsByIds(prisma, billIds);
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除全部账单失败:', error);
    return serverErrorResponse('删除全部账单失败', event);
  }
});
