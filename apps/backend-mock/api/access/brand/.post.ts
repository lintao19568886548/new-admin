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
  ensureSingleDefaultAccessBrand,
  normalizeAccessBrandData,
  normalizeBoolean,
} from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const body = await readBody(event);
    const data = normalizeAccessBrandData(body);
    const brandName = String(data.brandName || '').trim();
    const brandCode = String(data.brandCode || '').trim();

    if (!brandName) {
      return badRequestResponse('品牌名称不能为空', event);
    }
    if (!brandCode) {
      return badRequestResponse('品牌编码不能为空', event);
    }

    const createData: Prisma.AccessBrandUncheckedCreateInput = {
      apiEndpoint: data.apiEndpoint || null,
      appKey: data.appKey || null,
      appSecretRef: data.appSecretRef || null,
      brandCode,
      brandName,
      enabled: normalizeBoolean(data.enabled, true),
      isDefault: normalizeBoolean(data.isDefault, false),
      protocolType: data.protocolType || null,
      remark: data.remark || null,
    };

    const result = await prismaClient.$transaction(async (tx) => {
      if (createData.isDefault) {
        await ensureSingleDefaultAccessBrand({
          prismaClient: tx,
        });
      }

      return await tx.accessBrand.create({
        data: createData,
      });
    });

    return useResponseSuccess(result);
  } catch (error) {
    console.error('创建门禁品牌失败:', error);
    return serverErrorResponse('创建门禁品牌失败', event);
  }
});
