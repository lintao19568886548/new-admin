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
    const result = await prismaClient.$transaction(async (prisma) => {
      // 1. 查找与该厂房关联的所有楼层 ID
      const floorsToDelete = await prisma.factoryFloor.findMany({
        where: { factoryId },
        select: { floorId: true }, // 只需要楼层 ID
      });
      const floorIdsToDelete = floorsToDelete.map((floor) => floor.floorId);

      // 2. 如果存在关联楼层，则删除楼层图片关联记录
      if (floorIdsToDelete.length > 0) {
        await prisma.factoryFloorImage.deleteMany({
          where: {
            floorId: {
              in: floorIdsToDelete,
            },
          },
        });
        // 注意：这里不删除 Image 表本身的记录，因为图片可能被其他地方引用
      }

      // 3. 删除所有关联的楼层记录
      // 这一步也可以省略，如果 Prisma Schema 中设置了 Factory 到 FactoryFloor 的级联删除 (onDelete: Cascade)
      // 但显式删除更清晰，且不依赖 Schema 配置
      if (floorIdsToDelete.length > 0) {
        await prisma.factoryFloor.deleteMany({
          where: {
            factoryId, // 或者使用 floorId: { in: floorIdsToDelete }
          },
        });
      }

      // 4. 删除厂房本身
      // delete 操作会返回被删除的记录
      const deletedFactory = await prisma.factory.delete({
        where: {
          factoryId,
        },
      });

      return deletedFactory; // 返回被删除的厂房数据
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
    return useResponseError(
      `删除厂房失败: ${error.message || '未知错误'}`,
      500,
    );
  }
});
