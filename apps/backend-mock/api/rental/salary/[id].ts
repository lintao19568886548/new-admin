import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const salaryId = Number.parseInt(event.context.params.id);
  if (!salaryId) {
    return useResponseError('salaryId错误');
  }

  const salary = await prismaClient.salary.findUnique({
    where: {
      salaryId,
    },
  });

  if (!salary) {
    return useResponseError('工资记录不存在');
  }

  const tenant = await prismaClient.rentalTenant.findUnique({
    where: { rentalTenantId: salary.rentalTenantId },
    select: {
      rentalTenantId: true,
      tenantName: true,
      phoneNumber: true,
    },
  });

  return useResponseSuccess({
    ...salary,
    tenant,
    salaryAmount:
      salary.salaryAmount !== null && salary.salaryAmount !== undefined
        ? Number(salary.salaryAmount)
        : null,
    tenantName: tenant?.tenantName ?? '',
    phoneNumber: tenant?.phoneNumber ?? '',
  });
});
