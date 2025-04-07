import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const firefightingId = Number.parseInt(event.context.params.id);
  if (!firefightingId) {
    return useResponseError('investmentId错误');
  }

  const bill = await prismaClient.firefighting.findUnique({
    where: {
      firefightingId,
    },
  });
  return useResponseSuccess(bill);
});
