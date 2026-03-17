import { prismaClient } from '~/utils/db';
import { useResponseSuccess } from '~/utils/response';

import { sanitizeAmountBillPayload, upsertFinanceRecord } from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const billId = Number.parseInt(event.context.params.id);
  if (!billId) {
    return useResponseError('billId错误');
  }
  const body = await readBody(event);
  const sanitizedBody = sanitizeAmountBillPayload(body || {});
  const { eleBills, waterBills, parkId, tenantId, ...billData } = sanitizedBody;
  delete billData.tenant;
  delete billData.createTime;
  delete billData.updateTime;
  // 使用事务来确保所有操作都成功或都失败
  const updateBill = await prismaClient.$transaction(async (tx) => {
    // 获取当前数据库中的电费和水费账单记录
    const existingBill = await tx.amountBill.findUnique({
      where: { billId },
      include: {
        eleBills: true,
        waterBills: true,
      },
    });

    if (!existingBill) {
      throw new Error(`未找到ID为${billId}的账单记录`);
    }

    // 1. 创建、更新或删除财务记录
    const financeId = await upsertFinanceRecord(
      tx,
      {
        ...billData,
        parkId,
        // 为确保billName完整，从现有记录或新数据中获取
        tenantName: billData.tenantName || existingBill.tenantName,
        projectName: billData.projectName || existingBill.projectName,
      },
      (existingBill as any).financeId, // 使用类型断言绕过linter类型检查错误
    );

    // 2. 更新主账单
    const updatedAmountBill = await tx.amountBill.update({
      where: { billId },
      data: {
        ...billData,
        finance: financeId // 使用关联写入
          ? {
              connect: { financeId },
            }
          : {
              disconnect: true,
            },
        park: parkId
          ? {
              connect: { parkId },
            }
          : undefined,
        tenant: tenantId
          ? {
              connect: { rentalTenantId: tenantId },
            }
          : {
              disconnect: true,
            },
      },
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
            billId,
          },
        });
      }

      // 更新或创建电费账单记录
      // 定义基准时间
      const eleBaseTime = new Date();

      await Promise.all(
        eleBills.map((eleBill, index) => {
          const { eleId, billId: _billId, ...eleBillData } = eleBill; // 移除不需要的字段

          // 为每条记录添加轻微的时间偏移（每条记录增加1秒）
          const recordTime = new Date(eleBaseTime);
          recordTime.setSeconds(recordTime.getSeconds() + index);

          return eleId
            ? tx.eleBill.update({
                where: { eleId, billId },
                data: {
                  ...eleBillData,
                  updateTime: recordTime, // 添加更新时间
                }, // 使用清理后的数据进行更新
              })
            : tx.eleBill.create({
                data: {
                  ...eleBillData,
                  billId,
                  updateTime: recordTime, // 添加更新时间
                },
              });
        }),
      );
    } else if (existingBill.eleBills.length > 0) {
      // 如果前端没有传入电费账单数据，但数据库中存在，则删除所有电费账单
      await tx.eleBill.deleteMany({
        where: { billId },
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
            billId,
          },
        });
      }

      const waterBaseTime = new Date();
      // 更新或创建水费账单记录
      await Promise.all(
        waterBills.map((waterBill, index) => {
          const { waterId, billId: _billId, ...waterBillData } = waterBill; // 移除不需要的字段
          const recordTime = new Date(waterBaseTime);
          recordTime.setSeconds(recordTime.getSeconds() + index);
          return waterId
            ? tx.waterBill.update({
                where: { waterId, billId },
                data: {
                  ...waterBillData,
                  updateTime: recordTime,
                },
              })
            : tx.waterBill.create({
                data: {
                  ...waterBillData,
                  billId,
                  updateTime: recordTime,
                },
              });
        }),
      );
    } else if (existingBill.waterBills.length > 0) {
      // 如果前端没有传入水费账单数据，但数据库中存在，则删除所有水费账单
      await tx.waterBill.deleteMany({
        where: { billId },
      });
    }

    return updatedAmountBill;
  });

  return useResponseSuccess(updateBill);
});
