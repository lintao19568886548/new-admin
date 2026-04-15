import { prismaClient } from '~/utils/db';
import {
  attachSingleEmployeeBindingInfo,
  resolveEmployeeCustomerId,
} from '~/utils/employee-user-binding';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

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
    const customerId = resolveEmployeeCustomerId(userinfo.customerId);
    const employee = await prismaClient.employee.findUnique({
      where: {
        employeeId,
      },
    });

    if (!employee) {
      return useResponseError('员工不存在');
    }

    return useResponseSuccess(
      await attachSingleEmployeeBindingInfo(employee, customerId),
    );
  } catch (error) {
    console.error('获取员工信息失败:', error);
    return serverErrorResponse(`获取员工信息失败`, event);
  }
});
