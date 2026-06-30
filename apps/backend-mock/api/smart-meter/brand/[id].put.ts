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
  ensureSingleDefaultMeterBrand,
  normalizeMeterBrandData,
} from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const meterBrandId = Number(event.context.params?.id);
    if (!meterBrandId) {
      return useResponseError('meterBrandId 错误');
    }

    const current = await prismaClient.meterBrand.findUnique({
      where: {
        meterBrandId,
      },
    });
    if (!current) {
      return useResponseError('水电表品牌不存在');
    }

    const body = await readBody(event);
    const data = normalizeMeterBrandData(body);
    if (
      data.meterType !== undefined &&
      !['electric', 'water'].includes(data.meterType)
    ) {
      return badRequestResponse('表类型错误', event);
    }
    if (data.brandName !== undefined && !String(data.brandName).trim()) {
      return badRequestResponse('品牌名称不能为空', event);
    }
    if (data.brandCode !== undefined && !String(data.brandCode).trim()) {
      return badRequestResponse('品牌编码不能为空', event);
    }

    const nextMeterType = data.meterType || current.meterType;
    const result = await prismaClient.$transaction(async (tx) => {
      if (data.isDefault === true) {
        await ensureSingleDefaultMeterBrand({
          excludeId: meterBrandId,
          meterType: nextMeterType,
          prismaClient: tx,
        });
      }

      return await tx.meterBrand.update({
        data,
        where: {
          meterBrandId,
        },
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('更新水电表品牌失败:', error);
    return serverErrorResponse('更新水电表品牌失败', event);
  }
});
