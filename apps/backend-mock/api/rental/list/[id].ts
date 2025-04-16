import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const id = Number(event.context.params?.id);

    if (Number.isNaN(id)) {
      return useResponseError('无效的厂房ID', 400);
    }

    const factory = await prismaClient.factory.findUnique({
      where: { factoryId: id },
    });

    if (!factory) {
      return useResponseError('厂房不存在', 404);
    }

    return useResponseSuccess(factory);
  } catch (error) {
    console.error('获取厂房详情失败:', error);
    return useResponseError('获取厂房详情失败', 500);
  }
});
