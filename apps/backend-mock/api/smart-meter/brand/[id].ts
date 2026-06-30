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
    const meterBrandId = Number(event.context.params?.id);
    if (!meterBrandId) {
      return useResponseError('meterBrandId 错误');
    }

    const result = await prismaClient.meterBrand.findUnique({
      where: {
        meterBrandId,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('获取水电表品牌详情失败:', error);
    return serverErrorResponse('获取水电表品牌详情失败', event);
  }
});
