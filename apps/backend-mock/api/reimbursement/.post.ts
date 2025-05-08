import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log('请求体参数:', body);

  try {
    // 创建报销记录
    const reimbursement = await prismaClient.reimbursement.create({
      data: {
        ...body,
      },
    });

    console.log('插入报销数据成功:', reimbursement);
    return useResponseSuccess(reimbursement);
  } catch (error) {
    console.error('插入报销数据失败:', error);
    return useResponseError('插入报销数据失败', 500);
  }
});
