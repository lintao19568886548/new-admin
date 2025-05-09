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
    const factoriesWithParkInfo = await prismaClient.factory.findMany({
      where: {
        parkId: {
          in: authorizedParkIds, // 确保只查询用户有权限的园区下的厂房
        },
        isDeleted: false,
      },
      select: {
        factoryId: true,
        factoryName: true,
        address: true, // 如果前端Cascader不需要地址，可以考虑移除以减少数据量
        parkId: true, // 直接从厂房记录中获取 parkId
        park: {
          // 关联查询园区信息
          select: {
            parkName: true, // 获取园区名称
          },
        },
      },
    });

    // 返回的数据结构会是: Array<{ factoryId, factoryName, address, parkId, park: { parkName } }>
    return useResponseSuccess(factoriesWithParkInfo);
  } catch (error) {
    console.error('获取厂房列表失败:', error);
    return useResponseError('获取厂房列表失败', 500);
  }
});
