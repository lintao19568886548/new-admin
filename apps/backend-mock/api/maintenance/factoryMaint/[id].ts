import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const factoryMaintenanceId = Number.parseInt(event.context.params.id);
  if (!factoryMaintenanceId) {
    return useResponseError('factoryMaintenanceId错误');
  }

  const bill = await prismaClient.factoryMaintenance.findUnique({
    where: {
      factoryMaintenanceId,
    },
  });
  return useResponseSuccess(bill);
});
