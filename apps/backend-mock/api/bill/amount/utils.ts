/**
 * 创建或更新与 AmountBill 关联的财务记录。
 * 此函数应在 Prisma 事务中调用。
 * @params tx - Prisma 事务客户端。
 * @params billData - 包含收款信息的账单数据。
 * @params existingFinanceId - 已存在的财务记录ID（如果有）。
 * @returns 返回新的或已更新的 financeId，如果删除了记录则返回 null。
 */
export async function upsertFinanceRecord(
  tx: any,
  billData: {
    parkId?: null | number;
    projectName?: null | string;
    receiptAmount?: null | number | string;
    receiptTime?: Date | null | string;
    tenantName?: null | string;
  },
  existingFinanceId?: null | number,
): Promise<null | number> {
  const { receiptAmount, receiptTime, tenantName, projectName, parkId } =
    billData;

  const amount = Number(receiptAmount || 0);
  const hasReceipt = amount > 0 && receiptTime;

  // 如果需要创建或更新财务记录
  if (hasReceipt) {
    const financeData = {
      billName: projectName || '未知项目',
      billCategory: '账单收入',
      amount,
      transactionType: '收入',
      transactionTime: new Date(receiptTime),
      parkId: parkId || undefined,
      remark: tenantName || undefined,
    };

    // 如果已存在 financeId，则更新
    if (existingFinanceId) {
      await tx.finance.update({
        where: { financeId: existingFinanceId },
        data: financeData,
      });
      return existingFinanceId;
    }
    // 否则，创建新的记录
    else {
      const newFinance = await tx.finance.create({
        data: financeData,
      });
      return newFinance.financeId;
    }
  }
  // 如果不需要财务记录（金额为0或无收款时间），但之前存在关联，则删除
  else if (existingFinanceId) {
    await tx.finance.delete({ where: { financeId: existingFinanceId } });
  }

  return null;
}
