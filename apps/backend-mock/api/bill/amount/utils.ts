const MAX_BANK_ACCOUNT_FIELD_LENGTH = 60;
const MAX_METER_NAME_LENGTH = 120;
const MAX_PROJECT_NAME_LENGTH = 120;
const MAX_REMARK_LENGTH = 100;
const MAX_TENANT_NAME_LENGTH = 60;

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replaceAll(/\s+/g, ' ').trim();
}

function clipText(value: unknown, maxLength: number) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  return text.slice(0, maxLength);
}

function sanitizeBankAccountJson(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text);
    const sanitized = {
      bank: clipText(parsed?.bank, MAX_BANK_ACCOUNT_FIELD_LENGTH) || '',
      name: clipText(parsed?.name, MAX_BANK_ACCOUNT_FIELD_LENGTH) || '',
      number: clipText(parsed?.number, MAX_BANK_ACCOUNT_FIELD_LENGTH) || '',
    };

    return Object.values(sanitized).some(Boolean)
      ? JSON.stringify(sanitized)
      : null;
  } catch {
    return clipText(text, 180);
  }
}

function sanitizeBillItems(items: unknown): any {
  if (!Array.isArray(items)) {
    return items;
  }

  return items.map((item) => {
    if (!item || typeof item !== 'object') {
      return item;
    }

    return {
      ...item,
      meterName:
        clipText(
          (item as Record<string, any>).meterName,
          MAX_METER_NAME_LENGTH,
        ) || '',
      remark: clipText((item as Record<string, any>).remark, MAX_REMARK_LENGTH),
    };
  });
}

export function sanitizeAmountBillPayload(
  payload: Record<string, any>,
): Record<string, any> {
  const sanitized: Record<string, any> = {
    ...payload,
    eleBills: sanitizeBillItems(payload.eleBills),
    privateBankAccount: sanitizeBankAccountJson(payload.privateBankAccount),
    projectName: clipText(payload.projectName, MAX_PROJECT_NAME_LENGTH) || '',
    publicBankAccount: sanitizeBankAccountJson(payload.publicBankAccount),
    remark: clipText(payload.remark, MAX_REMARK_LENGTH),
    tenantName: clipText(payload.tenantName, MAX_TENANT_NAME_LENGTH),
    waterBills: sanitizeBillItems(payload.waterBills),
  };

  return sanitized;
}

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
      isDeleted: false,
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
    await tx.finance.update({
      data: {
        isDeleted: true,
      },
      where: { financeId: existingFinanceId },
    });
  }

  return null;
}
