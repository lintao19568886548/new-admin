import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    console.log('后端收到的查询参数:', query);

    // 构建查询条件
    const where: any = {
      isDeleted: false,
    };

    // 根据用户权限过滤：如果不是 vben 或 admin，则只查询用户所在园区的记录
    if (
      userinfo.username !== 'vben' &&
      userinfo.username !== '董事长' &&
      userinfo.username !== '总监'
    ) {
      // 获取用户所属的第一个园区ID
      const parkId = userinfo.parks?.[0]?.parkId;
      if (parkId) {
        where.parkId = parkId;
      } else {
        // 如果用户没有关联园区，则只查询自己的记录
        where.username = userinfo.username;
      }
    }

    // 用途模糊查询
    if (query.purpose) {
      where.purpose = { contains: String(query.purpose) };
    }

    // 部门查询
    if (query.department) {
      where.department = String(query.department);
    }

    // 领款人模糊查询
    if (query.payee) {
      where.payee = { contains: String(query.payee) };
    }

    // 日期范围查询
    if (query.startDate) {
      where.date = {
        ...where.date,
        gte: new Date(String(query.startDate)),
      };
    }

    if (query.endDate) {
      where.date = {
        ...where.date,
        lte: new Date(String(query.endDate)),
      };
    }

    if (query.status) {
      where.status = Number(query.status);
    }

    if (query.parkId) {
      where.parkId = Number(query.parkId);
    }

    // 分页参数
    const pageNo = Number(query.pageNo) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const skip = (pageNo - 1) * pageSize;

    // 查询总数
    const total = await prismaClient.reimbursement.count({ where });

    // 查询数据
    const reimbursements = await prismaClient.reimbursement.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: {
        createTime: 'desc',
      },
      include: {
        park: true,
        images: {
          include: {
            image: true,
          },
        },
      },
    });

    return useResponseSuccess({
      items: reimbursements.map((item) => ({
        ...item,
        park: item.park?.parkName || '',
        images: item.images.map((imageItem) => imageItem.image.imgUrl),
      })),
      total,
    });
  } catch (error) {
    console.error('查询报销数据失败:', error);
    return useResponseError('查询报销数据失败', 500);
  }
});
