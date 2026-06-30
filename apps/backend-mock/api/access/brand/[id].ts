import { prismaClient } from '~/utils/db';
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

  try {
    const accessBrandId = Number(event.context.params?.id);
    if (!accessBrandId) {
      return useResponseError('accessBrandId 错误');
    }

    const result = await prismaClient.accessBrand.findUnique({
      where: {
        accessBrandId,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('获取门禁品牌详情失败:', error);
    return serverErrorResponse('获取门禁品牌详情失败', event);
  }
});
