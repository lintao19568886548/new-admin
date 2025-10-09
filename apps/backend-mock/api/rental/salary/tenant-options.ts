import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const keyword = query.keyword ? String(query.keyword) : '';

    const accessibleParkIds =
      userinfo.parks?.map((park: any) => park.parkId) ?? [];

    const where: Record<string, any> = {
      isDeleted: false,
      status: '当期',
    };

    if (accessibleParkIds.length > 0) {
      where.parkId = {
        in: accessibleParkIds,
      };
    }

    if (keyword) {
      where.OR = [
        { tenantName: { contains: keyword } },
        { phoneNumber: { contains: keyword } },
      ];
    }

    const tenants = await prismaClient.rentalTenant.findMany({
      where,
      orderBy: {
        tenantName: 'asc',
      },
      select: {
        rentalTenantId: true,
        tenantName: true,
        phoneNumber: true,
      },
    });

    return useResponseSuccess(tenants);
  } catch (error) {
    console.error('获取合同人选项失败:', error);
    return serverErrorResponse('获取合同人选项失败', event);
  }
});
