import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const id = Number(event.context.params?.id);

  if (Number.isNaN(id)) {
    return useResponseError('无效的宿舍ID', 400);
  }

  // 从 body 中分离出 images 数据和 dormitory 的基本数据
  const { images, ...dormitoryData } = body;

  try {
    // 使用事务处理更新操作
    const dormitory = await prismaClient.$transaction(async (prisma) => {
      // 1. 更新宿舍基本信息 (不包括关联数据)
      await prisma.dormitory.update({
        where: { dormitoryId: id },
        data: {
          ...dormitoryData,
        },
      });

      // 2. 删除所有关联的 DormitoryImage 记录
      await prisma.dormitoryImage.deleteMany({
        where: { dormitoryId: id },
      });

      // 3. 创建新的图片关联
      if (images && Array.isArray(images) && images.length > 0) {
        // 使用 Promise.all 并行创建所有图片关联
        await Promise.all(
          images.map((image) =>
            prisma.dormitoryImage
              .create({
                data: {
                  imgId: image.imgId,
                  dormitoryId: id,
                },
              })
              .catch((error) => {
                // 处理可能的唯一约束冲突
                if (error.code === 'P2002') {
                  console.warn(
                    `宿舍图片关联已存在 (DormitoryId: ${id}, ImgId: ${image.imgId})`,
                  );
                } else {
                  console.error(`创建宿舍图片关联失败:`, error);
                  throw error; // 重新抛出其他错误
                }
              }),
          ),
        );
      }

      // 4. 查询并返回更新后的完整宿舍数据
      return await prisma.dormitory.findUnique({
        where: { dormitoryId: id },
        include: {
          images: {
            include: {
              image: true,
            },
          },
        },
      });
    });

    // 格式化返回数据，将图片关联转换为前端需要的格式
    const result = {
      ...dormitory,
      images: dormitory.images.map((imgRelation) => ({
        imgId: imgRelation.imgId,
        name: imgRelation.image?.imgUrl.split('/').at(-1) || '',
        url: imgRelation.image?.imgUrl || '',
      })),
    };

    return useResponseSuccess(result);
  } catch (error) {
    console.error('更新宿舍信息时发生错误:', error);
    return useResponseError(
      `更新宿舍失败: ${error.message || '未知错误'}`,
      500,
    );
  }
});
