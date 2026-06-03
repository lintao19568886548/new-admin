import { prismaClient } from '~/utils/db';
import { useResponseError, useResponseSuccess } from '~/utils/response';

function sanitizeParkPayload(input: Record<string, any>) {
  const area = Number(input.area);
  return {
    address: String(input.address || '').trim(),
    area: Number.isFinite(area) ? area : 0,
    description: input.description ? String(input.description) : null,
    parkName: String(input.parkName || '').trim(),
    status: input.status ? String(input.status) : null,
  };
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const id = Number.parseInt(event.context.params.id);
  if (!id) {
    return useResponseError('id is required');
  }

  const body = await readBody(event);
  const park = sanitizeParkPayload(body || {});

  if (!park.parkName || !park.address || !park.area) {
    return useResponseError('parkName, address and area are required');
  }

  try {
    const result = await prismaClient.park.update({
      data: park,
      where: {
        parkId: id,
      },
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('更新园区失败:', error);
    return useResponseError('更新园区失败', 500);
  }
});
