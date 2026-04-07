import { prismaClient } from '~/utils/db';
import {
  buildRentalTenantMutationData,
  createRentalTenantInclude,
  mapRentalTenantOutput,
} from '~/utils/rental-contract';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log(body);

  try {
    const tenant = await prismaClient.$transaction(async (tx) => {
      const created = await tx.rentalTenant.create({
        data: await buildRentalTenantMutationData(tx, body),
      });
      return tx.rentalTenant.findUnique({
        where: {
          rentalTenantId: created.rentalTenantId,
        },
        include: createRentalTenantInclude(),
      });
    });

    return useResponseSuccess(tenant ? mapRentalTenantOutput(tenant) : tenant);
  } catch (error) {
    console.error('创建租户失败:', error);
    return serverErrorResponse(`创建租户失败`, event);
  }
});
