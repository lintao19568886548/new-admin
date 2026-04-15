import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import {
  attachEmployeeBindingInfo,
  resolveEmployeeCustomerId,
} from '~/utils/employee-user-binding';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const customerId = resolveEmployeeCustomerId(userinfo.customerId);

    const query = getQuery(event);
    const { currentPage, pageSize } = query;

    const {
      name,
      phone,
      department,
      idNumber,
      gender,
      education,
      isDeleted,
      isResigned,
      hireDateStart,
      hireDateEnd,
    } = query;

    const where: any = {};

    if (isDeleted === 'true' || isDeleted === 'false') {
      where.isDeleted = isDeleted === 'true';
    } else if (
      isDeleted === undefined ||
      isDeleted === null ||
      isDeleted === ''
    ) {
      where.isDeleted = false;
    }

    if (isResigned === 'true' || isResigned === 'false') {
      where.isResigned = isResigned === 'true';
    }
    if (name) {
      where.name = { contains: name };
    }
    if (phone) {
      where.phone = { contains: phone };
    }
    if (department) {
      where.department = { contains: department };
    }
    if (idNumber) {
      where.idNumber = { contains: idNumber };
    }
    if (gender) {
      where.gender = gender;
    }
    if (education) {
      where.education = education;
    }
    if (hireDateStart && hireDateEnd) {
      const startDate = new Date(String(hireDateStart));
      const endDate = new Date(String(hireDateEnd));
      endDate.setHours(23, 59, 59, 999);
      where.hireDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const employees = await prismaClient.employee.findMany({
      where,
      orderBy: {
        createTime: 'desc',
      },
      skip: (Number(currentPage) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    const total = await prismaClient.employee.count({ where });

    const items = await attachEmployeeBindingInfo(employees, customerId);

    return useResponseSuccess({
      items,
      total,
    });
  } catch (error) {
    console.error('获取员工列表失败:', error);
    return serverErrorResponse(`获取员工列表失败`, event);
  }
});
