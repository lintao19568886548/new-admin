const REIMBURSEMENT_FINANCE_BILL_CATEGORY = '其他费用';
const REIMBURSEMENT_FINANCE_TRANSACTION_TYPE = '支出';

export function buildReimbursementFinanceRemark(reimbursementId: number) {
  return `报销 #${reimbursementId}`;
}

function getReimbursementImageUrls(reimbursement: Record<string, any>) {
  const images = Array.isArray(reimbursement.images)
    ? reimbursement.images
    : [];

  return images
    .map((item) => String(item?.image?.imgUrl || item?.url || '').trim())
    .filter(Boolean);
}

export async function syncApprovedReimbursementFinanceRecord(
  tx: any,
  reimbursement: Record<string, any>,
) {
  const reimbursementId = Number(reimbursement.id);
  const remark = buildReimbursementFinanceRemark(reimbursementId);
  const imageUrls = getReimbursementImageUrls(reimbursement);
  const financeData = {
    amount: reimbursement.amount,
    billCategory: REIMBURSEMENT_FINANCE_BILL_CATEGORY,
    billName: reimbursement.purpose,
    isDeleted: false,
    parkId: reimbursement.parkId,
    remark,
    transactionTime: reimbursement.createTime || new Date(),
    transactionType: REIMBURSEMENT_FINANCE_TRANSACTION_TYPE,
  };

  const existingRecords = await tx.finance.findMany({
    orderBy: {
      financeId: 'asc',
    },
    select: {
      financeId: true,
    },
    where: {
      remark,
      transactionType: REIMBURSEMENT_FINANCE_TRANSACTION_TYPE,
    },
  });

  const primaryFinanceId = existingRecords[0]?.financeId;
  let financeId = primaryFinanceId;

  if (primaryFinanceId) {
    await tx.finance.update({
      data: financeData,
      where: {
        financeId: primaryFinanceId,
      },
    });

    const duplicateFinanceIds = existingRecords
      .slice(1)
      .map((item: { financeId: number }) => item.financeId);
    if (duplicateFinanceIds.length > 0) {
      await tx.finance.updateMany({
        data: {
          isDeleted: true,
        },
        where: {
          financeId: {
            in: duplicateFinanceIds,
          },
        },
      });
    }
  } else {
    const createdFinance = await tx.finance.create({
      data: financeData,
      select: {
        financeId: true,
      },
    });
    financeId = createdFinance.financeId;
  }

  if (!financeId) {
    return null;
  }

  await tx.financeImage.deleteMany({
    where: {
      financeId,
    },
  });

  if (imageUrls.length > 0) {
    await tx.financeImage.createMany({
      data: imageUrls.map((url) => ({
        financeId,
        url,
      })),
    });
  }

  return financeId;
}

export async function softDeleteReimbursementFinanceRecords(
  tx: any,
  reimbursementId: number,
) {
  const remark = buildReimbursementFinanceRemark(reimbursementId);

  return tx.finance.updateMany({
    data: {
      isDeleted: true,
    },
    where: {
      isDeleted: false,
      remark,
      transactionType: REIMBURSEMENT_FINANCE_TRANSACTION_TYPE,
    },
  });
}
