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
    include: {
      tenant: {
        select: {
          rentalTenantId: true,
          tenantName: true,
          phoneNumber: true,
        },
      },
    },
  });

  if (!salary) {
    return useResponseError('工资记录不存在');
  }

  return useResponseSuccess({
    ...salary,
    salaryAmount:
      salary.salaryAmount !== null && salary.salaryAmount !== undefined
        ? Number(salary.salaryAmount)
        : null,
  });
});
