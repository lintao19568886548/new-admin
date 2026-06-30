import { getQuery } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

const OPTION_FIELDS = ['brandName', 'brandCode', 'protocolType'] as const;

type BrandOptionField = (typeof OPTION_FIELDS)[number];

function normalizeOptionField(field: unknown): BrandOptionField {
  const value = String(field || '').trim();

  return OPTION_FIELDS.includes(value as BrandOptionField)
    ? (value as BrandOptionField)
    : 'brandName';
}

function normalizeOptionValue(value: unknown) {
  return String(value || '').trim();
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  try {
    const query = getQuery(event);
    const field = normalizeOptionField(query.field);
    const keyword = normalizeOptionValue(query.keyword);
    const where: Record<string, any> = {};

    if (keyword) {
      where[field] = {
        contains: keyword,
      };
    }

    const records = await prismaClient.accessBrand.findMany({
      orderBy: [{ isDefault: 'desc' }, { accessBrandId: 'desc' }],
      select: {
        brandCode: true,
        brandName: true,
        protocolType: true,
      },
      take: 200,
      where,
    });

    const optionMap = new Map<string, string>();

    for (const record of records) {
      const value = normalizeOptionValue(record[field]);
      if (!value) {
        continue;
      }

      const mapKey = value.toLowerCase();
      if (!optionMap.has(mapKey)) {
        optionMap.set(mapKey, value);
      }
    }

    const options = [...optionMap.values()].slice(0, 100).map((value) => ({
      label: value,
      value,
    }));

    return useResponseSuccess(options);
  } catch (error) {
    console.error('获取门禁品牌搜索候选失败:', error);
    return serverErrorResponse('获取门禁品牌搜索候选失败', event);
  }
});
