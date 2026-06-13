import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const parseBooleanQuery = (value: unknown) => {
      if (value === true || value === false) {
        return value;
      }
      if (typeof value === 'string') {
        if (value === 'true') {
          return true;
        }
        if (value === 'false') {
          return false;
        }
      }
      return undefined;
    };

    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (currentPage - 1) * pageSize;
    const referenceDate = query.date
      ? new Date(String(query.date))
      : new Date();
    const referenceDay = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
    );
    const expiringLimit = new Date(referenceDay);
    expiringLimit.setMonth(expiringLimit.getMonth() + 1);

    const accessibleParkIds =
      userinfo.parks
        ?.map((park: { parkId: number }) => Number(park.parkId))
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

    // 构建查询条件
    const where: any = {
      isDeleted: false,
      parkId: {
        in: accessibleParkIds,
      },
    };

    // 区域查询
    if (query.currentPark) {
      if (Number(query.currentPark) === -1) {
        where.parkId = {
          in: accessibleParkIds,
        };
      } else if (accessibleParkIds.includes(Number(query.currentPark))) {
        where.parkId = Number(query.currentPark);
      } else {
        return useResponseError('没有查看权限');
      }
    }

    // 区域查询
    // if (query.currentPark && Number(query.currentPark) !== -1) {
    //   where.parkId = Number(query.currentPark);
    // }

    if (query.tenantName) {
      where.tenantName = { contains: query.tenantName };
    }
    if (query.phoneNumber) {
      where.phoneNumber = { contains: query.phoneNumber };
    }
    const transactionType = parseBooleanQuery(query.transactionType);
    if (transactionType !== undefined) {
      where.transactionType = transactionType;
    }
    if (query.status) {
      if (query.status === 'active') {
        // "生效中": contractEnd is in the future OR is null
        where.OR = [
          { contractEnd: { gte: referenceDay } },
          { contractEnd: null },
        ];
      } else if (query.status === 'expired') {
        // "过期": contractEnd is in the past AND not null
        where.contractEnd = {
          lt: referenceDay,
        };
      }
    }
    if (query.contractView === 'expiring') {
      where.contractEnd = {
        gte: referenceDay,
        lte: expiringLimit,
      };
      delete where.OR;
    }
    if (query.contractDate) {
      const [start, end] = (query.contractDate as string).split(',');
      where.contractStart = {
        gte: new Date(`${start} 00:00:00`), // 添加时间部分
        lte: new Date(`${end} 23:59:59`), // 添加时间部分，确保包含整天
      };
    } else if (query.contractStart && query.contractEnd) {
      where.contractStart = {
        gte: new Date(`${String(query.contractStart)} 00:00:00`),
        lte: new Date(`${String(query.contractEnd)} 23:59:59`),
      };
    }
    if (query.increaseDate) {
      const [start, end] = (query.increaseDate as string).split(',');
      where.increaseDate = {
        gte: new Date(`${start} 00:00:00`), // 添加时间部分
        lte: new Date(`${end} 23:59:59`), // 添加时间部分，确保包含整天
      };
    }
    if (query.address) {
      where.address = { contains: query.address };
    }
    if (query.increaseRate) {
      where.increaseRate = Number(query.increaseRate);
    }
    // 获取总数
    const total = await prismaClient.rentalTenant.count({ where });

    // 获取分页数据
    const tenants = await prismaClient.rentalTenant.findMany({
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

    const items = tenants.map(({ images, ...rest }) => {
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

      return {
        ...rest,
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
    console.error('获取租户列表失败:', error);
    return serverErrorResponse(`获取租户列表失败`, event);
  }
});
