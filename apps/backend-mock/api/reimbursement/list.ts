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
    const hasAuditPermission = (userinfo.reimbursementAuth || 0) > 0;
    const isApplicationQuery = query.type === 'application';
    const allowedParkIds = (userinfo.parks || [])
      .map((park) => Number(park.parkId))
      .filter((parkId) => !Number.isNaN(parkId));

    // 构建查询条件
    const where: any = {
      isDeleted: false,
    };

    // 兼容旧版本查询
    if (query.claimant) {
      where.claimant = String(query.claimant);
    }

    if (isApplicationQuery) {
      where.userId = userinfo.id;
    } else if (!hasAuditPermission) {
      // 非审核人员只能查看自己的申请记录
      where.userId = userinfo.id;
    } else if (allowedParkIds.length > 0) {
      // 审核人员仅可查看其可管辖园区
      where.parkId = { in: allowedParkIds };
    } else {
      // 审核人员无任何园区授权时返回空结果
      return useResponseSuccess({
        items: [],
        total: 0,
      });
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
      const parkId = Number(query.parkId);
      if (Number.isNaN(parkId)) {
        return useResponseError('园区参数无效', 400);
      }
      if (
        !isApplicationQuery &&
        hasAuditPermission &&
        !allowedParkIds.includes(parkId)
      ) {
        return useResponseSuccess({
          items: [],
          total: 0,
        });
      }
      where.parkId = parkId;
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
