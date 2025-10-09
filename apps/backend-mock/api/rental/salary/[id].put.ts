import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const salaryId = Number.parseInt(event.context.params.id);
  if (!salaryId) {
    return useResponseError('salaryId错误');
  }

  const body = await readBody(event);

  const data: Record<string, any> = {};

  if (body.rentalTenantId !== undefined && body.rentalTenantId !== null) {
    data.rentalTenantId = Number(body.rentalTenantId);
  }

  if (body.salaryAmount !== undefined) {
    const amount = Number(body.salaryAmount);
    data.salaryAmount = Number.isNaN(amount) ? null : amount;
  }

  if (body.issueDate !== undefined) {
    if (body.issueDate) {
      const issueDate = new Date(body.issueDate);
      data.issueDate = Number.isNaN(issueDate.getTime()) ? null : issueDate;
    } else {
      data.issueDate = null;
    }
  }

  if (body.issued !== undefined) {
    data.issued = Boolean(body.issued);
  }

  if (body.remark !== undefined) {
    data.remark = body.remark ?? null;
  }

  if (body.images && typeof body.images === 'object') {
    data.images = body.images;
  } else if (body.images === null) {
    data.images = { deleteMany: {} };
  }

  try {
    const salary = await prismaClient.salary.update({
      where: {
        salaryId,
      },
      data,
      include: {
        tenant: {
          select: {
            rentalTenantId: true,
            tenantName: true,
            phoneNumber: true,
          },
        },
        images: {
          include: {
            image: true,
          },
        },
      },
    });

    return useResponseSuccess({
      ...salary,
      salaryAmount:
        salary.salaryAmount !== null && salary.salaryAmount !== undefined
          ? Number(salary.salaryAmount)
          : null,
      images:
        salary.images
          ?.map((item) => {
            if (!item.image?.imgId || !item.image?.imgUrl) {
              return null;
            }
            return {
              imgId: item.image.imgId,
              url: item.image.imgUrl,
            };
          })
          .filter(
            (image): image is { imgId: number; url: string } => image !== null,
          ) ?? [],
    });
  } catch (error) {
    console.error('更新工资记录失败:', error);
    return serverErrorResponse('更新工资记录失败', event);
  }
});
