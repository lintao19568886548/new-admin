import { prismaClient } from '~/utils/db';
import { syncRentalExpenseFinanceRecords } from '~/utils/rental-expense-finance';
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
    const tenant = await prismaClient.rentalTenant.update({
      where: {
        rentalTenantId,
      },
      data: {
        ...body,
      },
    });

    try {
      await syncRentalExpenseFinanceRecords({
        tenantIds: [tenant.rentalTenantId],
      });
    } catch (syncError) {
      console.error('同步租户月度支出失败:', syncError);
    }

    return useResponseSuccess(tenant);
  } catch (error) {
    console.error('更新租户失败:', error);
    return serverErrorResponse(`更新租户失败`, event);
  }
});
