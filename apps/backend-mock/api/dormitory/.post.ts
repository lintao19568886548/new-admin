import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  // 从 body 中分离出 images 数据和 dormitory 的基本数据
  const { images, ...dormitoryData } = body;

  try {
    // 使用 Prisma 嵌套写入创建 Dormitory 及其关联的 Images
    const res = await prismaClient.dormitory.create({
      data: {
        ...dormitoryData, // 包含 parkId, dormitoryName 等基本信息
        // 嵌套创建 Images 关联
        images: {
          create:
            images?.map((image: { imgId: number }) => ({
              // 关联到已存在的 Image 记录
              imgId: image.imgId,
            })) || [], // 如果 images 不存在或为空，则创建空数组
        },
      },
      // 在返回结果中包含创建的 Images
      include: {
        images: {
          include: {
            image: true, // 包含关联的 Image 详细信息
          },
        },
      },
    });

    // 格式化返回数据，将图片关联转换为前端需要的格式
    const result = {
      ...res,
      images: res.images.map((imgRelation) => ({
        imgId: imgRelation.imgId,
        name: imgRelation.image?.imgUrl.split('/').at(-1) || '',
        url: imgRelation.image?.imgUrl || '',
      })),
    };

    return useResponseSuccess(result);
  } catch (error) {
    console.error('创建宿舍及关联数据失败:', error);
    return useResponseError(
      `创建宿舍失败: ${error.message || '未知错误'}`,
      500,
    );
  }
});
