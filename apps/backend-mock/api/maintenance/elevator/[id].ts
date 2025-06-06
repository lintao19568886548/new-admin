import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const elevatorId = Number.parseInt(event.context.params.id);
  if (!elevatorId) {
    return useResponseError('elevatorId错误');
  }

  const bill = await prismaClient.elevator.findUnique({
    where: {
      elevatorId,
    },
  });
  return useResponseSuccess(bill);
});
