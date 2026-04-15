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
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const body = await readBody(event);
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const employeeModel = prismaClient.employee as any;
    const customerId = resolveEmployeeCustomerId(userinfo.customerId);

    if (!body.name || !body.gender || !body.phone) {
      return serverErrorResponse('姓名、性别和电话是必填项', event, 400);
    }

    let ageVal: number | undefined;
    if (body.age !== null && body.age !== undefined && body.age !== '') {
      ageVal = Number.parseInt(body.age, 10);
      if (Number.isNaN(ageVal)) {
        return serverErrorResponse('年龄必须是一个有效的数字', event, 400);
      }
    }

    const normalizedUserId = normalizeEmployeeUserId(body.userId);
    const bindingValidation = await ensureEmployeeBindingUserAvailable({
      customerId,
      userId: normalizedUserId,
    });
    if (bindingValidation.error) {
      return serverErrorResponse(bindingValidation.error, event, 409);
    }

    if (body.idNumber) {
      const existingEmployeeByIdNumber = await employeeModel.findFirst({
        where: {
          idNumber: String(body.idNumber),
          isDeleted: false,
        },
      });
      if (existingEmployeeByIdNumber) {
        return serverErrorResponse('该身份证号已存在', event, 409);
      }
    }

    const dataToCreate = {
      name: String(body.name),
      gender: String(body.gender),
      phone: String(body.phone),
      userId: normalizedUserId,
      idNumber: body.idNumber ? String(body.idNumber) : undefined,
      department: body.department ? String(body.department) : undefined,
      age: ageVal,
      education: body.education ? String(body.education) : undefined,
      hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
      leaveDate: (() => {
        if (body.isResigned) {
          return body.leaveDate ? new Date(body.leaveDate) : undefined;
        } else {
          return null;
        }
      })(),
      address: body.address ? String(body.address) : undefined,
      remark: body.remark ? String(body.remark) : undefined,
      isDeleted: typeof body.isDeleted === 'boolean' ? body.isDeleted : false, // Default to false
      isResigned:
        typeof body.isResigned === 'boolean' ? body.isResigned : false,
      checkIn: body.checkIn ? new Date(body.checkIn) : undefined,
      checkOut: body.checkOut ? new Date(body.checkOut) : undefined,
    };

    const newEmployee = await employeeModel.create({
      data: dataToCreate,
    });

    return useResponseSuccess(
      await attachSingleEmployeeBindingInfo(newEmployee, customerId),
    );
  } catch (error: any) {
    console.error('创建员工失败:', error);

    if (error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined;
      const fields = target?.join(', ') || '未知字段';
      return serverErrorResponse(
        `操作失败：数据重复，字段 ${fields} 的值已存在。`,
        event,
        409,
      );
    }

    return serverErrorResponse(
      `创建员工失败，请稍后重试或联系管理员。服务端错误: ${error.message}`,
      event,
      500,
    );
  }
});
