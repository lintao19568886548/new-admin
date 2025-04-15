import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const body = await readBody(event);

  try {
    const accessVisitor = await prismaClient.accessVisitor.create({
      data: {
        ...body,
      },
    });

    return useResponseSuccess(accessVisitor);
  } catch (error) {
    console.error('创建访客信息失败:', error);
    return useResponseError('创建访客信息失败', 500);
  }
});
