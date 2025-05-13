import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

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

  // 查询所有园区
  const parks = await prismaClient.park.findMany({
    where: {
      isDeleted: false,
    },
    select: {
      parkId: true,
      parkName: true,
    },
  });

  // 获取每个园区的电费数据
  const parkElectricityData = await Promise.all(
    parks.map(async (park) => {
      // 查询园区下的所有账单
      const bills = await prismaClient.amountBill.findMany({
        where: {
          parkId: park.parkId,
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
      console.log('当前园区账单数量:', park.parkId, bills.length);
      bills.forEach((bill) => {
        console.log('账单ID:', bill.id, '包含电表数量:', bill.eleBills.length);
        bill.eleBills.forEach((e) =>
          console.log('电表名称:', e.meter_name, '用量:', e.totalUsage),
        );
      });

      // 计算园区总电度数和总电费
      let totalUsage = 0;
      let totalAmount = 0;

      // 按租户分组的数据
      const tenantData = [];

      // 处理每个账单的电费数据
      bills.forEach((bill) => {
        // 计算账单中的总电度数和总电费
        // 筛选合计电表数据
        const totalEleBill = bill.eleBills.find((e) => e.meterName === '合计');
        const billTotalUsage = totalEleBill
          ? Number(totalEleBill.totalUsage)
          : 0;
        const billTotalAmount = totalEleBill ? Number(totalEleBill.amount) : 0;

        totalUsage += billTotalUsage;
        totalAmount += billTotalAmount;

        // 如果有租户信息，添加到租户数据中
        if (bill.tenant) {
          tenantData.push({
            tenantId: bill.tenant.rentalTenantId,
            tenantName: bill.tenant.tenantName,
            usage: totalEleBill ? Number(totalEleBill.totalUsage) : 0,
            amount: totalEleBill ? Number(totalEleBill.amount) : 0,
          });
        }
      });

      return {
        parkId: park.parkId,
        parkName: park.parkName,
        totalUsage,
        totalAmount,
        tenants: tenantData,
      };
    }),
  );

  return useResponseSuccess(parkElectricityData);
});
