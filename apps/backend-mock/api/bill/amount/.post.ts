import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log('请求体参数:', body);
  const { eleBills, waterBills, ...billData } = body;
  try {
    // 使用事务处理创建操作
    const bill = await prismaClient.$transaction(async (prisma) => {
      // 创建账单及关联数据
      return await prisma.amountBill.create({
        data: {
          ...billData,
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
    console.log('插入数据成功:', bill);
    return useResponseSuccess(bill);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
