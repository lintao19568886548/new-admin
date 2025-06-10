import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // 获取当前日期信息
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript月份从0开始

  // 计算当月的开始和结束日期
  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0); // 当月最后一天

  // 从用户信息中获取用户有权访问的园区
  const parks = userinfo.parks || [];

  // 如果用户没有任何园区权限，则直接返回空数据
  if (!parks || parks.length === 0) {
    return useResponseSuccess([]);
  }

  // 获取用户有权访问的园区ID
  const parkIds = parks.map((park) => park.parkId);

  // 一次性查询所有园区的账单数据
  const allBills = await prismaClient.amountBill.findMany({
    where: {
      parkId: {
        in: parkIds,
      },
      receiptTime: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      eleBills: true,
      tenant: {
        select: {
          rentalTenantId: true,
          tenantName: true,
        },
      },
    },
  });

  // 按园区ID分组账单
  const billsByPark = {};
  parkIds.forEach((parkId) => {
    billsByPark[parkId] = allBills.filter((bill) => bill.parkId === parkId);
  });

  // 处理每个园区的数据
  const parkElectricityData = parks.map((park) => {
    const bills = billsByPark[park.parkId] || [];

    let totalUsage = 0;
    let totalAmount = 0;
    const tenantDataMap = new Map();

    bills.forEach((bill) => {
      let billTotalUsage = 0;
      let billTotalAmount = 0;

      const totalEleBill = bill.eleBills.find((e) => e.meterName === '合计');

      if (totalEleBill) {
        billTotalUsage = Number(totalEleBill.totalUsage) || 0;
        billTotalAmount = Number(totalEleBill.amount) || 0;
      } else {
        bill.eleBills.forEach((e) => {
          billTotalUsage += Number(e.totalUsage) || 0;
          billTotalAmount += Number(e.amount) || 0;
        });
      }

      totalUsage += billTotalUsage;
      totalAmount += billTotalAmount;

      if (bill.tenant) {
        const tenantId = bill.tenant.rentalTenantId;
        if (tenantDataMap.has(tenantId)) {
          const tenant = tenantDataMap.get(tenantId);
          tenant.usage += billTotalUsage;
          tenant.amount += billTotalAmount;
        } else {
          tenantDataMap.set(tenantId, {
            tenantId,
            tenantName: bill.tenant.tenantName,
            usage: billTotalUsage,
            amount: billTotalAmount,
          });
        }
      }
    });

    return {
      parkId: park.parkId,
      parkName: park.parkName,
      totalUsage,
      totalAmount,
      tenants: [...tenantDataMap.values()],
    };
  });

  return useResponseSuccess(parkElectricityData);
});
