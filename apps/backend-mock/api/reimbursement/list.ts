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

    // 根据用户权限过滤：如果不是特定高权限用户，则只查询用户关联园区的记录
    if (
      userinfo.username !== 'vben' &&
      userinfo.username !== '董事长' &&
      userinfo.username !== '总监'
    ) {
      const parkIds = userinfo.parks?.map((park) => park.parkId) || [];

      // 如果用户有关联的园区，则按园区过滤；否则，作为一个非高级用户，
      // 他们没有被分配可审计的园区，因此不应该看到任何记录。
      if (parkIds.length > 0) {
        where.parkId = { in: parkIds };
      } else {
        // 直接返回空结果，因为没有可审计的园区
        return useResponseSuccess({
          items: [],
          total: 0,
        });
      }
    }

    // 只有高级用户才能按申请人姓名进行模糊查询
    if (
      (userinfo.username === 'vben' ||
        userinfo.username === '董事长' ||
        userinfo.username === '总监') &&
      query.username
    ) {
      where.username = { contains: String(query.username) };
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
        park: item.park?.parkName || '', // 使用 park 关联对象的 parkName
        images: item.images.map((imageItem) => imageItem.image.imgUrl),
      })),
      total,
    });
  } catch (error) {
    console.error('查询报销数据失败:', error);
    return useResponseError('查询报销数据失败', 500);
  }
});
