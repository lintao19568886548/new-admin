import { prismaClient } from '~/utils/db';
import {
  attachSingleEmployeeBindingInfo,
  ensureEmployeeBindingUserAvailable,
  normalizeEmployeeUserId,
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
  const body = await readBody(event);
  const employeeId = Number.parseInt(event.context.params.id);
  if (!employeeId) {
    return useResponseError('employeeId错误');
  }

  try {
    const employeeModel = prismaClient.employee as any;
    const customerId = resolveEmployeeCustomerId(userinfo.customerId);

    const existingEmployee = await employeeModel.findUnique({
      where: { employeeId },
    });
    if (!existingEmployee) {
      return useResponseError('员工不存在');
    }

    if (body.idNumber && body.idNumber !== existingEmployee.idNumber) {
      const duplicateEmployee = await employeeModel.findFirst({
        where: {
          idNumber: body.idNumber,
          isDeleted: false,
          NOT: {
            employeeId,
          },
        },
      });
      if (duplicateEmployee) {
        return useResponseError('该身份证号已存在');
      }
    }

    const normalizedUserId = normalizeEmployeeUserId(body.userId);
    const bindingValidation = await ensureEmployeeBindingUserAvailable({
      customerId,
      excludeEmployeeId: employeeId,
      userId: normalizedUserId,
    });
    if (bindingValidation.error) {
      return useResponseError(bindingValidation.error);
    }

    const employee = await employeeModel.update({
      where: {
        employeeId,
      },
      data: {
        ...body,
        userId: normalizedUserId,
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

    return useResponseSuccess(
      await attachSingleEmployeeBindingInfo(employee, customerId),
    );
  } catch (error) {
    console.error('更新员工信息失败:', error);
    return serverErrorResponse(`更新员工信息失败`, event);
  }
});
