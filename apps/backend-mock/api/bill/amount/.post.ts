import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

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
      // 创建账单及关联数据
      return await prisma.amountBill.create({
        data: {
          ...billData,
          // 使用 connect 连接已存在的 Park 记录
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
    return serverErrorResponse(`插入数据失败\n${error}`, event);
  }
});
