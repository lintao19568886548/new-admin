import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const factoryId = Number(event.context.params?.id); // 使用 Number() 并处理 NaN
  if (Number.isNaN(factoryId)) {
    // 返回更清晰的错误信息和状态码
    return useResponseError('无效的厂房ID', 400);
  }

  try {
    // 使用事务处理删除操作，确保原子性
    const result = await prismaClient.factory.update({
      where: { factoryId },
      data: {
        isDeleted: true,
      },
    });

    // 返回成功响应，包含被删除的厂房数据
    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('删除厂房及关联数据失败:', error);
    // 处理 Prisma 特定的错误，例如记录未找到 (P2025)
    if (error.code === 'P2025') {
      return useResponseError(`未找到 ID 为 ${factoryId} 的厂房`, 404);
    }
    // 返回通用错误
    return serverErrorResponse(
      `删除厂房失败: ${error.message || '未知错误'}`,
      event,
    );
  }
});
