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
    const parkIds = (userinfo.parks || [])
      .map((park: { parkId: number }) => Number(park.parkId))
      .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0);

    if (parkIds.length === 0) {
      return useResponseSuccess({
        deletedBillCount: 0,
        deletedFinanceCount: 0,
      });
    }

    const bills = await prismaClient.amountBill.findMany({
      select: {
        billId: true,
      },
      where: {
        parkId: {
          in: parkIds,
        },
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
