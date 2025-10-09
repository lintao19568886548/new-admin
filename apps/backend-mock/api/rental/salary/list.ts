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

    const where: Record<string, any> = {};
    const tenantWhere: Record<string, any> = {};

    const accessibleParkIds =
      userinfo.parks?.map((park: any) => park.parkId) ?? [];

    if (query.currentPark !== undefined && query.currentPark !== null) {
      const currentPark = Number(query.currentPark);
      if (currentPark === -1) {
        if (accessibleParkIds.length > 0) {
          tenantWhere.parkId = {
            in: accessibleParkIds,
          };
        }
      } else if (accessibleParkIds.includes(currentPark)) {
        tenantWhere.parkId = currentPark;
      } else {
        return useResponseError('没有查看权限');
      }
    } else if (accessibleParkIds.length > 0) {
      tenantWhere.parkId = {
        in: accessibleParkIds,
      };
    }

    if (query.tenantName) {
      tenantWhere.tenantName = { contains: String(query.tenantName) };
    }

    if (query.phoneNumber) {
      tenantWhere.phoneNumber = { contains: String(query.phoneNumber) };
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

    if (Object.keys(tenantWhere).length > 0) {
      where.tenant = tenantWhere;
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
        tenant: {
          select: {
            rentalTenantId: true,
            tenantName: true,
            phoneNumber: true,
          },
        },
      },
    });

    const items = salaries.map(({ tenant, ...rest }) => ({
      ...rest,
      salaryAmount:
        rest.salaryAmount !== null && rest.salaryAmount !== undefined
          ? Number(rest.salaryAmount)
          : null,
      tenantName: tenant?.tenantName ?? '',
      phoneNumber: tenant?.phoneNumber ?? '',
    }));

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
