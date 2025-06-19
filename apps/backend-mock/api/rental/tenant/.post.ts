import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  console.log(body);

  try {
    const tenant = await prismaClient.rentalTenant.create({
      data: {
        ...body,
      },
    });

    return useResponseSuccess(tenant);
  } catch (error) {
    console.error('创建租户失败:', error);
    return serverErrorResponse(`创建租户失败`, event);
  }
});
