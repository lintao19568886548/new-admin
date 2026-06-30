import type { Prisma } from '@prisma/.prisma/client/index.js';

import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

import {
  ensureSingleDefaultMeterBrand,
  normalizeBoolean,
  normalizeMeterBrandData,
} from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = await readBody(event);
    const data = normalizeMeterBrandData(body);
    const meterType = String(data.meterType || '').trim();
    const brandName = String(data.brandName || '').trim();
    const brandCode = String(data.brandCode || '').trim();

    if (!['electric', 'water'].includes(meterType)) {
      return badRequestResponse('表类型错误', event);
    }
    if (!brandName) {
      return badRequestResponse('品牌名称不能为空', event);
    }
    if (!brandCode) {
      return badRequestResponse('品牌编码不能为空', event);
    }

    const createData: Prisma.MeterBrandUncheckedCreateInput = {
      apiEndpoint: data.apiEndpoint || null,
      appKey: data.appKey || null,
      appSecretRef: data.appSecretRef || null,
      brandCode,
      brandName,
      enabled: normalizeBoolean(data.enabled, true),
      isDefault: normalizeBoolean(data.isDefault, false),
      meterType,
      protocolType: data.protocolType || null,
      remark: data.remark || null,
    };

    const result = await prismaClient.$transaction(async (tx) => {
      if (createData.isDefault) {
        await ensureSingleDefaultMeterBrand({
          meterType,
          prismaClient: tx,
        });
      }

      return await tx.meterBrand.create({
        data: createData,
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('创建水电表品牌失败:', error);
    return serverErrorResponse('创建水电表品牌失败', event);
  }
});
