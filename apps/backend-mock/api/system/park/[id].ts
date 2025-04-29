import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('id不能为空');
  }

  try {
    // 查询园区详细信息，包括关联的工厂和宿舍
    const park = await prismaClient.park.findUnique({
      where: { parkId: id },
      include: {
        factories: {
          include: {
            floors: {
              include: {
                images: {
                  include: {
                    image: true, // 包含图片详细信息
                  },
                },
              },
            },
          },
        },
        dormitories: {
          include: {
            images: {
              include: {
                image: true, // 包含图片详细信息
              },
            },
          },
        },
      },
    });

    if (!park) {
      return useResponseError(`未找到ID为${id}的园区`);
    }

    // 处理返回数据，将图片关联数据转换为更易于前端使用的格式
    const result = {
      ...park,
      factories: park.factories.map((factory) => ({
        ...factory,
        floors: factory.floors.map((floor) => ({
          ...floor,
          // 将图片关联数据转换为图片数组
          images: floor.images.map((imgRelation) => ({
            imgId: imgRelation.imgId,
            name: imgRelation.image?.imgUrl.split('/').at(-1) || '',
            url: imgRelation.image?.imgUrl || '',
          })),
        })),
      })),
      dormitories: park.dormitories.map((dormitory) => ({
        ...dormitory,
        // 将图片关联数据转换为图片数组
        images: dormitory.images.map((imgRelation) => ({
          imgId: imgRelation.imgId,
          name: imgRelation.image?.imgUrl.split('/').at(-1) || '',
          imgUrl: imgRelation.image?.imgUrl || '',
        })),
      })),
    };

    console.log(result);
    return useResponseSuccess(result);
  } catch (error) {
    console.error('获取园区详情失败:', error);
    return useResponseError('获取园区详情失败', 500);
  }
});
