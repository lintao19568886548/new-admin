import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const rentalTenantId = Number.parseInt(event.context.params.id);
  if (!rentalTenantId) {
    return useResponseError('tenantId错误');
  }

  const tenant = await prismaClient.rentalTenant.findUnique({
    where: {
      rentalTenantId,
    },
    include: {
      images: {
        include: {
          image: true,
        },
      },
    },
  });
  if (!tenant) {
    return useResponseError('租户不存在');
  }
  const mappedImages =
    tenant.images
      ?.map((item) => {
        if (!item.image?.imgId || !item.image?.imgUrl) {
          return null;
        }
        return {
          imgId: item.image.imgId,
          url: item.image.imgUrl,
        };
      })
      .filter(
        (image): image is { imgId: number; url: string } => image !== null,
      ) ?? [];
  return useResponseSuccess({
    ...tenant,
    images: mappedImages,
  });
});
