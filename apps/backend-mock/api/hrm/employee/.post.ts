import { H3Event } from 'h3'; // Import H3Event for type safety if not already global
import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

// If you have verifyAccessToken defined elsewhere (e.g., in a composable or utils)
// import { verifyAccessToken } from '~/server/utils/auth'; // Adjust path as needed

export default eventHandler(async (event: H3Event) => {
  // Step 1: Read the request body
  const body = await readBody(event);
  console.log(
    '[HRM_POST_DEBUG] Received request body:',
    JSON.stringify(body, null, 2),
  );

  // Step 2: (Optional but Recommended) Authenticate the user
  // For now, assuming verifyAccessToken is available or you might skip this for initial testing.
  // If you don't have verifyAccessToken or want to skip auth for now, comment this block out.
  /*
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('[HRM_POST_AUTH] Authentication failed.');
    return unAuthorizedResponse(event);
  }
  console.log('[HRM_POST_AUTH] Authenticated user:', userinfo.username);
  */

  try {
    // Step 3: Validate incoming data
    if (!body.name || !body.gender || !body.phone) {
      console.warn(
        '[HRM_POST_VALIDATION] Validation failed: Name, gender, or phone missing.',
      );
      return serverErrorResponse('姓名、性别和电话是必填项', event, 400);
    }

    // Step 4: Prepare data for database insertion (type conversion, defaults)
    let hireDateObj: Date | undefined;
    if (body.hireDate) {
      hireDateObj = new Date(body.hireDate);
      if (Number.isNaN(hireDateObj.getTime())) {
        console.warn(
          '[HRM_POST_VALIDATION] Invalid hireDate format:',
          body.hireDate,
        );
        return serverErrorResponse(
          '入职日期格式无效，请使用 YYYY-MM-DD',
          event,
          400,
        );
      }
    }

    let leaveDateObj: Date | undefined;
    if (body.leaveDate) {
      leaveDateObj = new Date(body.leaveDate);
      if (Number.isNaN(leaveDateObj.getTime())) {
        console.warn(
          '[HRM_POST_VALIDATION] Invalid leaveDate format:',
          body.leaveDate,
        );
        return serverErrorResponse(
          '离职日期格式无效，请使用 YYYY-MM-DD',
          event,
          400,
        );
      }
    }

    let ageVal: number | undefined;
    if (body.age !== null && body.age !== undefined && body.age !== '') {
      ageVal = Number.parseInt(body.age, 10);
      if (Number.isNaN(ageVal)) {
        console.warn('[HRM_POST_VALIDATION] Invalid age format:', body.age);
        return serverErrorResponse('年龄必须是一个有效的数字', event, 400);
      }
    }

    // Check for idNumber uniqueness if provided
    if (body.idNumber) {
      const existingEmployeeByIdNumber = await prismaClient.employee.findUnique(
        {
          where: { idNumber: String(body.idNumber) },
        },
      );
      if (existingEmployeeByIdNumber) {
        console.warn(
          '[HRM_POST_VALIDATION] Validation failed: idNumber already exists.',
          body.idNumber,
        );
        return serverErrorResponse('该身份证号已存在', event, 409); // 409 Conflict
      }
    }

    const dataToCreate = {
      name: String(body.name),
      gender: String(body.gender),
      phone: String(body.phone),
      idNumber: body.idNumber ? String(body.idNumber) : undefined,
      department: body.department ? String(body.department) : undefined,
      age: ageVal,
      education: body.education ? String(body.education) : undefined,
      hireDate: hireDateObj,
      leaveDate: leaveDateObj,
      address: body.address ? String(body.address) : undefined,
      remark: body.remark ? String(body.remark) : undefined,
      isDeleted: typeof body.isDeleted === 'boolean' ? body.isDeleted : false, // Default to false
    };

    console.log(
      '[HRM_POST_DEBUG] Data prepared for database insertion:',
      JSON.stringify(dataToCreate, null, 2),
    );

    // Step 5: Insert data into the database
    const newEmployee = await prismaClient.employee.create({
      data: dataToCreate,
    });

    console.log(
      '[HRM_POST_SUCCESS] Employee successfully created in database:',
      newEmployee.employeeId,
    );
    return useResponseSuccess(newEmployee);
  } catch (error: any) {
    console.error('[HRM_POST_ERROR] Failed to create employee:', error.message);
    console.error('[HRM_POST_ERROR_STACK]', error.stack);

    if (error.code === 'P2002') {
      // Prisma unique constraint violation
      const target = error.meta?.target as string[] | undefined;
      const fields = target?.join(', ') || '未知字段';
      console.warn(
        `[HRM_POST_ERROR] Prisma unique constraint violation on: ${fields}`,
      );
      return serverErrorResponse(
        `操作失败：数据重复，字段 ${fields} 的值已存在。`,
        event,
        409,
      );
    }

    // Generic server error for other cases
    return serverErrorResponse(
      `创建员工失败，请稍后重试或联系管理员。服务端错误: ${error.message}`,
      event,
      500,
    );
  }
});
