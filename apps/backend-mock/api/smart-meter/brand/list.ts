import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const currentPage = Number(query.currentPage) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: Record<string, any> = {};

    if (query.meterType) {
      where.meterType = String(query.meterType);
    }
    if (query.brandName) {
      where.brandName = {
        contains: String(query.brandName).trim(),
      };
    }
    if (query.brandCode) {
      where.brandCode = {
        contains: String(query.brandCode).trim(),
      };
    }
    if (query.protocolType) {
      where.protocolType = {
        contains: String(query.protocolType).trim(),
      };
    }
    if (query.enabled !== undefined && query.enabled !== '') {
      where.enabled =
        query.enabled === true ||
        query.enabled === 'true' ||
        Number(query.enabled) === 1;
    }
    if (query.isDefault !== undefined && query.isDefault !== '') {
      where.isDefault =
        query.isDefault === true ||
        query.isDefault === 'true' ||
        Number(query.isDefault) === 1;
    }

    const total = await prismaClient.meterBrand.count({ where });
    const items = await prismaClient.meterBrand.findMany({
      orderBy: [{ isDefault: 'desc' }, { meterBrandId: 'desc' }],
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      where,
    });

    return useResponseSuccess({
      currentPage,
      items,
      pageSize,
      total,
    });
  } catch (error) {
    console.error('获取水电表品牌列表失败:', error);
    return serverErrorResponse('获取水电表品牌列表失败', event);
  }
});
