import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    console.log('[HRM Debug] 请求获取所有员工数据, User:', userinfo.username);

    const query = getQuery(event);
    const { currentPage, pageSize } = query;

    // 获取所有员工数据
    const employees = await prismaClient.employee.findMany({
      where: {
        isDeleted: false,
      },
      orderBy: {
        createTime: 'desc',
      },
      skip: (Number(currentPage) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    const total = await prismaClient.employee.count({});

    console.log('[HRM Debug] 数据库查询结果:', {
      totalEmployees: total,
      firstEmployeeId: employees[0]?.employeeId,
    });

    return useResponseSuccess({
      items: employees,
      total,
    });
  } catch (error) {
    console.error('获取员工列表失败:', error);
    return serverErrorResponse(`获取员工列表失败\n${error}`, event);
  }
});
