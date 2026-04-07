import { prismaClient } from '~/utils/db';
import {
  createRentalTenantInclude,
  mapRentalTenantOutput,
} from '~/utils/rental-contract';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const rentalTenantId = Number.parseInt(event.context.params.id);
  if (!rentalTenantId) {
    return useResponseError('rentalTenantId错误');
  }

  try {
    const tenant = await prismaClient.rentalTenant.findUnique({
      where: {
        rentalTenantId,
      },
      include: createRentalTenantInclude({ includeImages: false }),
    });

    if (!tenant) {
      return useResponseError('租户不存在', 404);
    }
    const mappedTenant = mapRentalTenantOutput(tenant);

    // 格式化日期
    const formatDate = (date: Date | null) => {
      if (!date) return '';
      return date.toISOString().split('T')[0];
    };

    return useResponseSuccess({
      contractEndDate: formatDate(tenant.contractEnd),
      increaseDate: tenant.increaseDate ? formatDate(tenant.increaseDate) : '',
      partyBContactPhone: mappedTenant.partyBContactPhone,
      partyBName: mappedTenant.partyBName,
      phoneNumber: mappedTenant.phoneNumber,
      tenantName: mappedTenant.tenantName,
    });
  } catch (error) {
    console.error('获取租户短信信息失败:', error);
    return useResponseError('获取租户短信信息失败', 500);
  }
});
