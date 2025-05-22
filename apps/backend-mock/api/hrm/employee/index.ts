import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    console.log('[HRM Debug] 请求获取所有员工数据, User:', userinfo.username);

    // 获取所有员工数据
    const employees = await prismaClient.employee.findMany({
      orderBy: {
        createTime: 'desc',
      },
    });

    const total = employees.length;

    console.log('[HRM Debug] 数据库查询结果:', {
      totalEmployees: total,
      firstEmployeeId: employees[0]?.employeeId,
    });

    return useResponseSuccess({
      items: employees,
      total,
      currentPage: 1,
      pageSize: total > 0 ? total : 1,
    });
  } catch (error) {
    console.error('获取员工列表失败:', error);
    return serverErrorResponse(`获取员工列表失败\n${error}`, event);
  }
});
