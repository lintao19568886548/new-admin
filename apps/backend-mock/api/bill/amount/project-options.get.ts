import {
  compareAmountBillProjectDesc,
  normalizeAmountBillProjectName,
} from '~/utils/amount-bill-project-period';
import { prismaClient } from '~/utils/db';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const query = getQuery(event);
  const keyword = normalizeAmountBillProjectName(query.keyword);
  const currentPark = Number(query.currentPark ?? query.parkId ?? -1);

  const where: any = {};
  if (Number.isInteger(currentPark) && currentPark > 0) {
    where.parkId = currentPark;
  }

  if (keyword) {
    where.projectName = {
      contains: keyword,
    };
  }

  const records = await prismaClient.amountBill.findMany({
    select: {
      billId: true,
      createTime: true,
      projectName: true,
      receiptTime: true,
    },
    where,
  });

  const projectMap = new Map<string, (typeof records)[number]>();

  for (const record of records) {
    const projectName = normalizeAmountBillProjectName(record.projectName);
    if (!projectName) {
      continue;
    }

    const mapKey = projectName.toLowerCase();
    const existing = projectMap.get(mapKey);
    if (!existing || compareAmountBillProjectDesc(record, existing) < 0) {
      projectMap.set(mapKey, {
        ...record,
        projectName,
      });
    }
  }

  const options = [...projectMap.values()]
    .sort(compareAmountBillProjectDesc)
    .slice(0, 100)
    .map((record) => ({
      label: record.projectName,
      value: record.projectName,
    }));

  return useResponseSuccess(options);
});
