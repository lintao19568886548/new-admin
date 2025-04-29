import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  // 从 body 中分离出 floors 数据和 factory 的基本数据
  const { floors, ...factoryData } = body;
  console.log('floors', floors);
  try {
    // 使用 Prisma 嵌套写入创建 Factory 及其关联的 Floors 和 Images
    const res = await prismaClient.factory.create({
      data: {
        ...factoryData, // 包含 parkId, factoryName 等基本信息
        // 嵌套创建 Floors
        floors: {
          create:
            floors?.map((floor: any) => {
              // 从 floor 数据中分离出 images 数据
              const { images, ...floorData } = floor;
              return {
                ...floorData, // 包含 floorName, totalArea 等楼层信息
                // 嵌套创建 Floor Images (通过关联已存在的 Image)
                images: {
                  create:
                    images?.map((image: { imgId: number }) => ({
                      // 这里假设 FactoryFloorImage 模型通过 imgId 字段关联 Image 模型
                      // 你需要根据你的 FactoryFloorImage 模型定义来调整这里的结构
                      // 通常是关联到一个已存在的 Image 记录
                      image: {
                        connect: { imgId: image.imgId },
                      },
                    })) || [], // 如果 images 不存在或为空，则创建空数组
                },
              };
            }) || [], // 如果 floors 不存在或为空，则创建空数组
        },
      },
      // 可选：在返回结果中包含创建的 Floors 和 Images
      include: {
        floors: {
          include: {
            images: {
              include: {
                image: true, // 包含关联的 Image 详细信息
              },
            },
          },
        },
      },
    });
    return useResponseSuccess(res);
  } catch (error) {
    console.error('创建厂房及关联数据失败:', error);
    // 提供更详细的错误信息给前端可能有助于调试，但生产环境要注意信息安全
    return useResponseError(
      `创建厂房失败: ${error.message || '未知错误'}`,
      500,
    );
  }
});
