import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const dormitoryId = Number(event.context.params?.id);
  if (Number.isNaN(dormitoryId)) {
    return useResponseError('无效的宿舍ID', 400);
  }

  try {
    // 使用事务处理删除操作，确保原子性
    const result = await prismaClient.$transaction(async (prisma) => {
      // 1. 先删除所有关联的图片记录
      await prisma.dormitoryImage.deleteMany({
        where: {
          dormitoryId,
        },
      });
      // 注意：这里不删除 Image 表本身的记录，因为图片可能被其他地方引用

      // 2. 删除宿舍本身
      const deletedDormitory = await prisma.dormitory.delete({
        where: {
          dormitoryId,
        },
      });

      return deletedDormitory; // 返回被删除的宿舍数据
    });

    // 返回成功响应，包含被删除的宿舍数据
    return useResponseSuccess(result);
  } catch (error: any) {
    console.error('删除宿舍及关联数据失败:', error);
    // 处理 Prisma 特定的错误，例如记录未找到 (P2025)
    if (error.code === 'P2025') {
      return useResponseError(`未找到 ID 为 ${dormitoryId} 的宿舍`, 404);
    }
    // 返回通用错误
    return useResponseError(
      `删除宿舍失败: ${error.message || '未知错误'}`,
      500,
    );
  }
});
