import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const investmentId = Number.parseInt(event.context.params.id);
  if (!investmentId) {
    return useResponseError('investmentId错误');
  }

  const bill = await prismaClient.investment.findUnique({
    where: {
      investmentId,
    },
  });
  return useResponseSuccess(bill);
});
