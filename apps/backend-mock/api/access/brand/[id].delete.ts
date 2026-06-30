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

    const result = await prismaClient.accessBrand.delete({
      where: {
        accessBrandId,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除门禁品牌失败:', error);
    return serverErrorResponse('删除门禁品牌失败', event);
  }
});
