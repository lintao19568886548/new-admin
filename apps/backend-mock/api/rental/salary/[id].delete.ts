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

  try {
    const result = await prismaClient.$transaction(async (tx) => {
      await tx.salaryImage.deleteMany({
        where: {
          salaryId,
        },
      });

      return await tx.salary.delete({
        where: {
          salaryId,
        },
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('删除工资记录失败:', error);
    return serverErrorResponse('删除工资记录失败', event);
  }
});
