import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (currentPage - 1) * pageSize;

    const where: Record<string, any> = {
      isDeleted: false,
    };
    const tenantWhere: Record<string, any> = {
      isDeleted: false,
    };
    let requireTenantFilter = false;

    const accessibleParkIds =
      userinfo.parks
        ?.map((park: any) => Number(park.parkId))
        .filter((parkId: number) => Number.isInteger(parkId) && parkId > 0) ??
      [];

    if (accessibleParkIds.length === 0) {
      return useResponseSuccess({
        items: [],
        total: 0,
        currentPage,
        pageSize,
      });
    }

    tenantWhere.parkId = {
      in: accessibleParkIds,
    };
    requireTenantFilter = true;

    if (query.currentPark !== undefined && query.currentPark !== null) {
      const currentPark = Number(query.currentPark);
      if (currentPark === -1) {
        tenantWhere.parkId = {
          in: accessibleParkIds,
        };
        requireTenantFilter = true;
      } else if (accessibleParkIds.includes(currentPark)) {
        tenantWhere.parkId = currentPark;
        requireTenantFilter = true;
      } else {
        return useResponseError('没有查看权限');
      }
    }

    if (query.tenantName) {
      tenantWhere.tenantName = { contains: String(query.tenantName) };
      requireTenantFilter = true;
    }

    if (query.phoneNumber) {
      tenantWhere.phoneNumber = { contains: String(query.phoneNumber) };
      requireTenantFilter = true;
    }

    if (query.issued !== undefined && query.issued !== '') {
      const issued = String(query.issued).toLowerCase();
      if (issued === 'true' || issued === '1') {
        where.issued = true;
      } else if (issued === 'false' || issued === '0') {
        where.issued = false;
      }
    }

    if (query.issueDate) {
      const [start, end] = String(query.issueDate).split(',');
      if (start) {
        where.issueDate = {
          ...where.issueDate,
          gte: new Date(`${start} 00:00:00`),
        };
      }
      if (end) {
        where.issueDate = {
          ...where.issueDate,
          lte: new Date(`${end} 23:59:59`),
        };
      }
    }

    if (query.salaryAmount) {
      const amount = Number(query.salaryAmount);
      if (!Number.isNaN(amount)) {
        where.salaryAmount = amount;
      }
    }

    let tenantMap = new Map<
      number,
      { phoneNumber: string; tenantName: string }
    >();

    if (requireTenantFilter) {
      const tenants = await prismaClient.rentalTenant.findMany({
        where: tenantWhere,
        select: {
          rentalTenantId: true,
          tenantName: true,
          phoneNumber: true,
        },
      });

      if (tenants.length === 0) {
        return useResponseSuccess({
          items: [],
          total: 0,
          currentPage,
          pageSize,
        });
      }

      where.rentalTenantId = {
        in: tenants.map((tenant) => tenant.rentalTenantId),
      };

      tenantMap = new Map(
        tenants.map((tenant) => [
          tenant.rentalTenantId,
          {
            tenantName: tenant.tenantName,
            phoneNumber: tenant.phoneNumber,
          },
        ]),
      );
    }

    const total = await prismaClient.salary.count({
      where,
    });

    const salaries = await prismaClient.salary.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
      include: {
        images: {
          include: {
            image: true,
          },
        },
      },
    });

    const tenantIds = [
      ...new Set(
        salaries
          .map((item) => item.rentalTenantId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];

    const missingTenantIds = tenantIds.filter((id) => !tenantMap.has(id));

    if (missingTenantIds.length > 0) {
      const tenants = await prismaClient.rentalTenant.findMany({
        where: {
          rentalTenantId: {
            in: missingTenantIds,
          },
          isDeleted: false,
        },
        select: {
          rentalTenantId: true,
          tenantName: true,
          phoneNumber: true,
        },
      });
      for (const tenant of tenants) {
        tenantMap.set(tenant.rentalTenantId, {
          tenantName: tenant.tenantName,
          phoneNumber: tenant.phoneNumber,
        });
      }
    }

    const items = salaries.map(({ images, ...rest }) => {
      const mappedImages =
        images
          ?.map((item) => {
            if (!item.image?.imgId || !item.image?.imgUrl) {
              return null;
            }
            return {
              imgId: item.image.imgId,
              url: item.image.imgUrl,
            };
          })
          .filter(
            (image): image is { imgId: number; url: string } => image !== null,
          ) ?? [];

      const tenantInfo = tenantMap.get(rest.rentalTenantId);

      return {
        ...rest,
        salaryAmount:
          rest.salaryAmount !== null && rest.salaryAmount !== undefined
            ? Number(rest.salaryAmount)
            : null,
        tenantName: tenantInfo?.tenantName ?? '',
        phoneNumber: tenantInfo?.phoneNumber ?? '',
        images: mappedImages,
      };
    });

    return useResponseSuccess({
      items,
      total,
      currentPage,
      pageSize,
    });
  } catch (error) {
    console.error('获取工资列表失败:', error);
    return serverErrorResponse('获取工资列表失败', event);
  }
});
