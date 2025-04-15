import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const transformerId = Number.parseInt(event.context.params.id);
  if (!transformerId) {
    return useResponseError('transformerId错误');
  }

  const bill = await prismaClient.transformer.findUnique({
    where: {
      transformerId,
    },
  });
  return useResponseSuccess(bill);
});
