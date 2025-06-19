import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const employeeId = Number.parseInt(event.context.params.id);
  if (!employeeId) {
    return useResponseError('employeeId错误');
  }

  try {
    // 验证员工是否存在
    const existingEmployee = await prismaClient.employee.findUnique({
      where: { employeeId },
    });
    if (!existingEmployee) {
      return useResponseError('员工不存在');
    }

    // 执行软删除操作
    const employee = await prismaClient.employee.update({
      where: {
        employeeId,
      },
      data: {
        isDeleted: true,
        // 如果员工还没有离职日期，则设置为当前日期
        leaveDate: existingEmployee.leaveDate || new Date(),
      },
    });

    return useResponseSuccess(employee, '删除员工成功');
  } catch (error) {
    console.error('删除员工信息失败:', error);
    return serverErrorResponse(`删除员工信息失败\n${error}`, event);
  }
});
