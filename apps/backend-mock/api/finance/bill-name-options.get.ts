import Nzh from 'nzh';
import { prismaClient } from '~/utils/db';
import {
  compareFinanceBillNameDesc,
  normalizeFinanceBillName,
} from '~/utils/finance-bill-name-period';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

const nzhcn = Nzh.cn;

function buildBillNameKeywordWhere(keyword: string) {
  if (!keyword) {
    return undefined;
  }

  const arabicNumbers = keyword.match(/\d+/g) || [];
  const chineseNumbers =
    keyword.match(/[零一二三四五六七八九十百千万亿]+/g) || [];
  const orConditions = [{ billName: { contains: keyword } }];

  for (const num of arabicNumbers) {
    try {
      const chineseNum = nzhcn.encodeS(num);
      orConditions.push({ billName: { contains: chineseNum } });
    } catch (error) {
      console.warn(`转换阿拉伯数字 ${num} 到中文失败:`, error);
    }
  }

  for (const num of chineseNumbers) {
    try {
      const arabicNum = String(nzhcn.decodeS(num));
      orConditions.push({ billName: { contains: arabicNum } });
    } catch (error) {
      console.warn(`转换中文数字 ${num} 到阿拉伯数字失败:`, error);
    }
  }

  return orConditions;
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const keyword = normalizeFinanceBillName(query.keyword);
  const requestedParkId = Number(query.parkId ?? query.currentPark ?? -1);
  const accessibleParkIds =
    userinfo.parks?.map((park) => Number(park.parkId)).filter(Boolean) ?? [];

  if (accessibleParkIds.length === 0) {
    return useResponseSuccess([]);
  }

  const where: any = {
    isDeleted: false,
  };

  if (Number.isInteger(requestedParkId) && requestedParkId > 0) {
    if (!accessibleParkIds.includes(requestedParkId)) {
      return useResponseSuccess([]);
    }

    where.parkId = requestedParkId;
  } else {
    where.parkId = {
      in: accessibleParkIds,
    };
  }

  const billNameKeywordWhere = buildBillNameKeywordWhere(keyword);
  if (billNameKeywordWhere) {
    where.OR = billNameKeywordWhere;
  }

  const records = await prismaClient.finance.findMany({
    select: {
      billName: true,
      createTime: true,
      financeId: true,
      transactionTime: true,
    },
    where,
  });

  const billNameMap = new Map<string, (typeof records)[number]>();

  for (const record of records) {
    const billName = normalizeFinanceBillName(record.billName);
    if (!billName) {
      continue;
    }

    const mapKey = billName.toLowerCase();
    const existing = billNameMap.get(mapKey);
    if (!existing || compareFinanceBillNameDesc(record, existing) < 0) {
      billNameMap.set(mapKey, {
        ...record,
        billName,
      });
    }
  }

  const options = [...billNameMap.values()]
    .sort(compareFinanceBillNameDesc)
    .slice(0, 100)
    .map((record) => ({
      label: record.billName,
      value: record.billName,
    }));

  return useResponseSuccess(options);
});
