import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

import { upsertFinanceRecord } from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { eleBills, waterBills, parkId, tenantId, ...billData } = body;
  try {
    // 使用事务处理创建操作
    const bill = await prismaClient.$transaction(async (prisma) => {
      // 1. 创建或更新财务记录
      const financeId = await upsertFinanceRecord(prisma, {
        ...billData,
        parkId,
      });

      // 2. 创建账单及关联数据
      return await prisma.amountBill.create({
        data: {
          ...billData,
          finance: financeId // 使用关联写入
            ? {
                connect: { financeId },
              }
            : undefined,
          park: parkId
            ? {
                connect: { parkId },
              }
            : undefined,
          tenant: tenantId
            ? {
                connect: { rentalTenantId: tenantId },
              }
            : undefined,
          eleBills: {
            create: eleBills,
          },
          waterBills: {
            create: waterBills,
          },
        },
        include: {
          eleBills: true,
          waterBills: true,
        },
      });
    });
    return useResponseSuccess(bill);
  } catch (error) {
    console.error('插入数据失败:', error);
    return serverErrorResponse(`插入数据失败`, event);
  }
});
