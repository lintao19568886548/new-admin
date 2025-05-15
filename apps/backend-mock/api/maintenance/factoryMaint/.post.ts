import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    console.log('userinfo', userinfo);
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log('请求体参数:', body);

  // 从请求体中分离 parkId，其余字段（包括 factoryId）收集到 dataForCreate
  const { ...dataForCreate } = body;
  // parkId 被忽略，因为它不直接是 FactoryMaintenance 的字段
  // factoryId (如果存在于 body 中) 会被包含在 dataForCreate 中，这对于 create 操作通常是允许的

  try {
    // 使用处理后的 dataForCreate 创建记录
    const res = await prismaClient.factoryMaintenance.create({
      data: dataForCreate, // 使用移除了 parkId 的 dataForCreate
    });
    console.log('插入数据成功:', res);
    return useResponseSuccess(res);
  } catch (error) {
    console.error('插入数据失败:', error);
    return useResponseError('插入数据失败', 500);
  }
});
