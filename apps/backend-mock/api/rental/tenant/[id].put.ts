import { prismaClient } from '~/utils/db';
import {
  buildRentalTenantMutationData,
  createRentalTenantInclude,
  mapRentalTenantOutput,
} from '~/utils/rental-contract';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const rentalTenantId = Number.parseInt(event.context.params.id);
  if (!rentalTenantId) {
    return useResponseError('tenantId错误');
  }

  console.log(body);
  try {
    const tenant = await prismaClient.$transaction(async (tx) => {
      await tx.rentalTenant.update({
        where: {
          rentalTenantId,
        },
        data: await buildRentalTenantMutationData(tx, body, {
          isUpdate: true,
        }),
      });
      return tx.rentalTenant.findUnique({
        where: {
          rentalTenantId,
        },
        include: createRentalTenantInclude(),
      });
    });
    return useResponseSuccess(tenant ? mapRentalTenantOutput(tenant) : tenant);
  } catch (error) {
    console.error('更新租户失败:', error);
    return serverErrorResponse(`更新租户失败`, event);
  }
});
