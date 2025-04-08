import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);

  try {
    const tenant = await prismaClient.tenant.create({
      data: {
        tenantName: body.tenantName,
        phoneNumber: body.phoneNumber,
        status: body.status,
        contractDate: new Date(body.contractDate), // 修改这里，转换为 Date 对象
        increaseDate: new Date(body.increaseDate), // 修改这里，转换为 Date 对象
        increaseRate: Number.parseFloat(body.increaseRate),
        address: body.address,
        createTime: new Date(),
        updateTime: new Date(),
      },
    });

    return useResponseSuccess(tenant);
  } catch (error) {
    console.error('创建租户失败:', error);
    return useResponseError('创建租户失败', 500);
  }
});
