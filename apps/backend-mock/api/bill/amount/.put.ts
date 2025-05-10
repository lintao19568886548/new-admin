import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const { eleBills, waterBills, ...billData } = body;
  delete billData.tenant;
  delete billData.createTime;
  delete billData.updateTime;
  if (!billData.billId) {
    return useResponseError('billId错误');
  }

  // 使用事务来确保所有操作都成功或都失败
  const updateBill = await prismaClient.$transaction(async (tx) => {
    // 获取当前数据库中的电费和水费账单记录
    const existingBill = await tx.amountBill.findUnique({
      where: { billId: billData.billId },
      include: {
        eleBills: true,
        waterBills: true,
      },
    });

    if (!existingBill) {
      throw new Error(`未找到ID为${billData.billId}的账单记录`);
    }

    // 更新主账单
    const updatedAmountBill = await tx.amountBill.update({
      where: { billId: billData.billId },
      data: { ...billData },
    });

    // 处理电费账单
    if (eleBills && Array.isArray(eleBills)) {
      // 找出需要删除的电费账单记录
      const existingEleIds = existingBill.eleBills.map((bill) => bill.eleId);
      const newEleIds = new Set(
        eleBills.filter((bill) => bill.eleId).map((bill) => bill.eleId),
      );
      const eleIdsToDelete = existingEleIds.filter((id) => !newEleIds.has(id));

      // 删除不再存在的电费账单记录
      if (eleIdsToDelete.length > 0) {
        await tx.eleBill.deleteMany({
          where: {
            eleId: { in: eleIdsToDelete },
            billId: billData.billId,
          },
        });
      }

      // 更新或创建电费账单记录
      await Promise.all(
        eleBills.map((eleBill) => {
          const { eleId, billId: _billId, ...eleBillData } = eleBill; // 移除不需要的字段
          return eleId
            ? tx.eleBill.update({
                where: { eleId, billId: billData.billId },
                data: eleBillData, // 使用清理后的数据进行更新
              })
            : tx.eleBill.create({
                data: {
                  ...eleBillData,
                  billId: billData.billId,
                },
              });
        }),
      );
    } else if (existingBill.eleBills.length > 0) {
      // 如果前端没有传入电费账单数据，但数据库中存在，则删除所有电费账单
      await tx.eleBill.deleteMany({
        where: { billId: billData.billId },
      });
    }

    // 处理水费账单
    if (waterBills && Array.isArray(waterBills)) {
      // 找出需要删除的水费账单记录
      const existingWaterIds = existingBill.waterBills.map(
        (bill) => bill.waterId,
      );
      const newWaterIds = new Set(
        waterBills.filter((bill) => bill.waterId).map((bill) => bill.waterId),
      );
      const waterIdsToDelete = existingWaterIds.filter(
        (id) => !newWaterIds.has(id),
      );

      // 删除不再存在的水费账单记录
      if (waterIdsToDelete.length > 0) {
        await tx.waterBill.deleteMany({
          where: {
            waterId: { in: waterIdsToDelete },
            billId: billData.billId,
          },
        });
      }

      // 更新或创建水费账单记录
      await Promise.all(
        waterBills.map((waterBill) => {
          const { waterId, billId: _billId, ...waterBillData } = waterBill; // 移除不需要的字段
          return waterId
            ? tx.waterBill.update({
                where: { waterId, billId: billData.billId },
                data: waterBillData, // 使用清理后的数据进行更新
              })
            : tx.waterBill.create({
                data: {
                  ...waterBillData,
                  billId: billData.billId,
                },
              });
        }),
      );
    } else if (existingBill.waterBills.length > 0) {
      // 如果前端没有传入水费账单数据，但数据库中存在，则删除所有水费账单
      await tx.waterBill.deleteMany({
        where: { billId: billData.billId },
      });
    }

    return updatedAmountBill;
  });

  return useResponseSuccess(updateBill);
});
