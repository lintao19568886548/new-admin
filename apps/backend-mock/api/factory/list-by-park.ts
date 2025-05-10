import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  console.log(
    'userinfouserinfo.parks.map((park) => park.parkId):\n',
    userinfo.parks.map((park) => park.parkId),
  );

  const authorizedParkIds = userinfo.parks.map((park) => park.parkId);

  // 获取查询参数
  try {
    // 查询指定园区下的厂房列表，并包含园区信息
    const parks = await prismaClient.park.findMany({
      where: {
        parkId: {
          in: authorizedParkIds, // 确保只查询用户有权限的园区下的厂房
        },
        isDeleted: false,
      },
      select: {
        parkId: true,
        parkName: true,
        factories: {
          where: {
            isDeleted: false,
          },
          select: {
            factoryId: true,
            factoryName: true,
          },
        },
      },
    });

    const result = parks.map((park) => ({
      name: park.parkName,
      value: park.parkId,
      children: park.factories.map((factory) => ({
        isLeaf: true,
        value: factory.factoryId,
        name: factory.factoryName,
      })),
    }));

    // 返回的数据结构会是: Array<{ factoryId, factoryName, address, parkId, park: { parkName } }>
    return useResponseSuccess(result);
  } catch (error) {
    console.error('获取厂房列表失败:', error);
    return useResponseError('获取厂房列表失败', 500);
  }
});
