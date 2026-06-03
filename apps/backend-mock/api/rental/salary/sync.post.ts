import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = (await readBody(event)) || {};
    const currentParkParam = body.currentPark;

    const accessibleParkIds =
      userinfo.parks
        ?.map((park: any) => Number(park.parkId))
        .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0) ??
      [];

    if (accessibleParkIds.length === 0) {
      return useResponseSuccess({
        total: 0,
        created: 0,
        skipped: 0,
      });
    }

    const now = new Date();
    const where: Record<string, any> = {
      isDeleted: false,
      AND: [
        {
          OR: [{ contractEnd: null }, { contractEnd: { gte: now } }],
        },
        {
          OR: [{ contractStart: null }, { contractStart: { lte: now } }],
        },
      ],
      parkId: {
        in: accessibleParkIds,
      },
    };

    if (
      currentParkParam !== undefined &&
      currentParkParam !== null &&
      Number(currentParkParam) !== -1
    ) {
      const targetParkId = Number(currentParkParam);
      if (
        accessibleParkIds.length > 0 &&
        !accessibleParkIds.includes(targetParkId)
      ) {
        return useResponseError('没有操作权限');
      }
      where.parkId = targetParkId;
    } else {
      where.parkId = {
        in: accessibleParkIds,
      };
    }

    const tenants = await prismaClient.rentalTenant.findMany({
      where,
      select: {
        rentalTenantId: true,
      },
    });

    const tenantIds = tenants.map((tenant) => tenant.rentalTenantId);

    if (tenantIds.length === 0) {
      return useResponseSuccess({
        total: 0,
        created: 0,
        skipped: 0,
      });
    }

    const existingSalaries = await prismaClient.salary.findMany({
      where: {
        rentalTenantId: {
          in: tenantIds,
        },
        isDeleted: false,
      },
      select: {
        rentalTenantId: true,
      },
    });

    const existingTenantIds = new Set(
      existingSalaries.map((item) => item.rentalTenantId),
    );

    const missingTenantIds = tenantIds.filter(
      (id) => !existingTenantIds.has(id),
    );

    if (missingTenantIds.length > 0) {
      await prismaClient.salary.createMany({
        data: missingTenantIds.map((id) => ({
          rentalTenantId: id,
        })),
        skipDuplicates: true,
      });
    }

    return useResponseSuccess({
      total: tenantIds.length,
      created: missingTenantIds.length,
      skipped: tenantIds.length - missingTenantIds.length,
    });
  } catch (error) {
    console.error('同步合同工资记录失败:', error);
    return serverErrorResponse('同步合同工资记录失败', event);
  }
});
