import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('carId错误');
  }

  const accessCar = await prismaClient.accessCar.findUnique({
    where: {
      carId: id,
    },
  });
  return useResponseSuccess(accessCar);
});
