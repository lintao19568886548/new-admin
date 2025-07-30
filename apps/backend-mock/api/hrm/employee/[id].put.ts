import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
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

    // 如果更新身份证号，验证其唯一性
    if (body.idNumber && body.idNumber !== existingEmployee.idNumber) {
      const duplicateEmployee = await prismaClient.employee.findUnique({
        where: {
          idNumber: body.idNumber,
          isDeleted: false,
        },
      });
      if (duplicateEmployee) {
        return useResponseError('该身份证号已存在');
      }
    }

    const employee = await prismaClient.employee.update({
      where: {
        employeeId,
      },
      data: {
        ...body,
        checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
        checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
        hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
        leaveDate: (() => {
          if (body.isResigned) {
            return body.leaveDate ? new Date(body.leaveDate) : undefined;
          } else {
            return null;
          }
        })(),
      },
    });

    return useResponseSuccess(employee);
  } catch (error) {
    console.error('更新员工信息失败:', error);
    return serverErrorResponse(`更新员工信息失败`, event);
  }
});
