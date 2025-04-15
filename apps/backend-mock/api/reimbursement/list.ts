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
    const where: any = {};

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
    });

    return useResponseSuccess({
      items: reimbursements,
      total,
    });
  } catch (error) {
    console.error('查询报销数据失败:', error);
    return useResponseError('查询报销数据失败', 500);
  }
});
