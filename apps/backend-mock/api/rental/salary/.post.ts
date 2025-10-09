import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = await readBody(event);

  if (!body || !body.rentalTenantId) {
    return useResponseError('合同人不能为空');
  }

  try {
    const rentalTenantId = Number(body.rentalTenantId);
    const issued = body.issued === undefined ? undefined : Boolean(body.issued);
    const remark = body.remark ?? undefined;

    let salaryAmount: number | undefined;
    if (body.salaryAmount !== undefined && body.salaryAmount !== null) {
      const amount = Number(body.salaryAmount);
      if (!Number.isNaN(amount)) {
        salaryAmount = amount;
      }
    }

    let issueDate: Date | undefined;
    if (body.issueDate) {
      const parsed = new Date(body.issueDate);
      if (!Number.isNaN(parsed.getTime())) {
        issueDate = parsed;
      }
    }

    const salary = await prismaClient.salary.create({
      data: {
        rentalTenantId,
        ...(issued === undefined ? {} : { issued }),
        ...(remark === undefined ? {} : { remark }),
        ...(salaryAmount === undefined ? {} : { salaryAmount }),
        ...(issueDate ? { issueDate } : {}),
      },
      include: {
        tenant: {
          select: {
            rentalTenantId: true,
            tenantName: true,
            phoneNumber: true,
          },
        },
      },
    });

    return useResponseSuccess(salary);
  } catch (error) {
    console.error('创建工资记录失败:', error);
    return serverErrorResponse('创建工资记录失败', event);
  }
});
