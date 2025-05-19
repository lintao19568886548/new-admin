import { prismaClient } from '~/utils/db';
import { serverErrorResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const body = await readBody(event);

  try {
    if (body.parkId === undefined || body.parkId === null) {
      return useResponseError('园区ID错误');
    }

    const accessVisitor = await prismaClient.accessVisitor.create({
      data: {
        ...body,
      },
    });

    return useResponseSuccess(accessVisitor);
  } catch (error) {
    console.error('创建访客信息失败:', error);
    return serverErrorResponse(`创建访客信息失败\n${error}`, event);
  }
});
