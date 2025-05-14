import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const hygieneCheckId = Number.parseInt(event.context.params.id); // 修改点
  if (!hygieneCheckId) {
    // 修改点
    return useResponseError('hygieneCheckId错误'); // 修改点
  }

  const bill = await prismaClient.hygieneCheck.findUnique({
    // 修改点
    where: {
      hygieneCheckId, // 修改点
    },
  });
  return useResponseSuccess(bill);
});
