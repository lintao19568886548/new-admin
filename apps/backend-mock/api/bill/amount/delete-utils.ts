export async function deleteAmountBillsByIds(tx: any, billIds: number[]) {
  if (!Array.isArray(billIds) || billIds.length === 0) {
    return {
      deletedBillCount: 0,
      deletedFinanceCount: 0,
    };
  }

  const bills = await tx.amountBill.findMany({
    select: {
      billId: true,
      financeId: true,
    },
    where: {
      billId: {
        in: billIds,
      },
    },
  });

  const existingBillIds = bills.map((item: { billId: number }) => item.billId);
  const financeIds = bills
    .map((item: { financeId?: null | number }) => item.financeId)
    .filter((id: null | number): id is number => typeof id === 'number');

  if (existingBillIds.length === 0) {
    return {
      deletedBillCount: 0,
      deletedFinanceCount: 0,
    };
  }

  await tx.eleBill.deleteMany({
    where: {
      billId: {
        in: existingBillIds,
      },
    },
  });

  await tx.waterBill.deleteMany({
    where: {
      billId: {
        in: existingBillIds,
      },
    },
  });

  await tx.amountBill.deleteMany({
    where: {
      billId: {
        in: existingBillIds,
      },
    },
  });

  if (financeIds.length > 0) {
    await tx.finance.updateMany({
      data: {
        isDeleted: true,
      },
      where: {
        financeId: {
          in: financeIds,
        },
      },
    });
  }

  return {
    deletedBillCount: existingBillIds.length,
    deletedFinanceCount: financeIds.length,
  };
}
