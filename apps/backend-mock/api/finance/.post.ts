import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  const {
    billName,
    billCategory,
    transactionType,
    amount,
    parkId,
    remark,
    transactionTime,
    images,
  } = body;

  // 确保 billName 存在
  if (!billName) {
    return badRequestResponse('账单名称 (billName) 是必填项', event);
  }

  try {
    const financeData = {
      amount,
      billCategory,
      billName,
      parkId,
      remark,
      transactionTime: transactionTime ? new Date(transactionTime) : new Date(),
      transactionType,
      ...(images && images.length > 0
        ? {
            images: {
              create: images.map((img: string | { url: string }) => ({
                url: typeof img === 'string' ? img : img.url,
              })),
            },
          }
        : {}),
    };

    // 创建财务记录
    const finance = await prismaClient.finance.create({
      data: financeData,
    });

    return useResponseSuccess(finance);
  } catch (error) {
    console.error('插入财务数据失败:', error);
    return serverErrorResponse(`插入财务数据失败`, event);
  }
});
