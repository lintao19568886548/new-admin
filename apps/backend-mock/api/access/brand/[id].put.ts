import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

import {
  ensureSingleDefaultAccessBrand,
  normalizeAccessBrandData,
} from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const accessBrandId = Number(event.context.params?.id);
    if (!accessBrandId) {
      return useResponseError('accessBrandId 错误');
    }

    const current = await prismaClient.accessBrand.findUnique({
      where: {
        accessBrandId,
      },
    });
    if (!current) {
      return useResponseError('门禁品牌不存在');
    }

    const body = await readBody(event);
    const data = normalizeAccessBrandData(body);
    if (data.brandName !== undefined && !String(data.brandName).trim()) {
      return badRequestResponse('品牌名称不能为空', event);
    }
    if (data.brandCode !== undefined && !String(data.brandCode).trim()) {
      return badRequestResponse('品牌编码不能为空', event);
    }

    const result = await prismaClient.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await ensureSingleDefaultAccessBrand({
          excludeId: accessBrandId,
          prismaClient: tx,
        });
      }

      return await tx.accessBrand.update({
        data,
        where: {
          accessBrandId,
        },
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('更新门禁品牌失败:', error);
    return serverErrorResponse('更新门禁品牌失败', event);
  }
});
