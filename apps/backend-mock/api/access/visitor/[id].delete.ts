import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('visitorId错误');
  }

  try {
    await prismaClient.accessVisitor.delete({
      where: {
        visitorId: id,
      },
    });
    return useResponseSuccess(null);
  } catch (error) {
    console.error('删除访客信息失败:', error);
    return serverErrorResponse(`删除访客信息失败`, event);
  }
});
