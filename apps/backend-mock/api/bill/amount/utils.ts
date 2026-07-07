import { getAmountBillProjectPeriodError } from '~/utils/amount-bill-project-period';

const AMOUNT_BILL_RECONCILIATION_TOLERANCE = Number(
  process.env.AMOUNT_BILL_RECONCILIATION_TOLERANCE ?? 0.5,
);
const MAX_BANK_ACCOUNT_FIELD_LENGTH = 60;
const MAX_METER_NAME_LENGTH = 120;
const MAX_PROJECT_NAME_LENGTH = 120;
const MAX_REMARK_LENGTH = 100;
const MAX_TENANT_NAME_LENGTH = 60;

export function toPositiveInteger(value: unknown) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0
    ? Math.floor(normalized)
    : null;
}

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

function toAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sumItemAmount(items: unknown) {
  if (!Array.isArray(items)) {
    return 0;
  }

  let sum = 0;
  for (const item of items) {
    sum += toAmount((item as Record<string, unknown>)?.amount);
  }

  return roundMoney(sum);
}

const STANDARD_FEE_ITEM_NAMES = new Set([
  '厂房租金',
  '垃圾处理费',
  '垃圾管理费',
  '基本管理费',
  '开票税金',
  '服务费',
  '本月收费金额',
  '水费',
  '滞纳金',
  '电费',
]);

function isStandardFeeItem(itemName: string) {
  const normalized = itemName.trim();
  if (!normalized) {
    return true;
  }

  return (
    STANDARD_FEE_ITEM_NAMES.has(normalized) || normalized.includes('厂房租金')
  );
}

function sumExtraFeeItems(extraProjectItem: unknown) {
  const text = normalizeText(extraProjectItem);
  if (!text) {
    return 0;
  }

  try {
    const items = JSON.parse(text) as Array<{
      itemName?: string;
      value?: unknown;
    }>;
    if (!Array.isArray(items)) {
      return 0;
    }

    let sum = 0;
    for (const item of items) {
      const itemName = normalizeText(item?.itemName);
      if (!itemName || isStandardFeeItem(itemName)) {
        continue;
      }
      sum += toAmount(item?.value);
    }

    return roundMoney(sum);
  } catch {
    return 0;
  }
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

  return items
    .filter((item): item is Record<string, any> => {
      const meterName =
        item && typeof item === 'object'
          ? normalizeText((item as Record<string, any>).meterName)
          : '';

      return Boolean(meterName) && meterName !== '合计';
    })
    .map((item) => {
      return {
        ...item,
        meterName:
          clipText(
            (item as Record<string, any>).meterName,
            MAX_METER_NAME_LENGTH,
          ) || '',
        remark: clipText(
          (item as Record<string, any>).remark,
          MAX_REMARK_LENGTH,
        ),
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

function buildReconciliationError(
  title: string,
  expected: number,
  actual: number,
) {
  return `${title}不一致：账单金额 ${expected.toFixed(
    2,
  )} 元，校验金额 ${actual.toFixed(2)} 元`;
}

export function validateAmountBillReconciliation(
  payload: Record<string, any>,
  tolerance = AMOUNT_BILL_RECONCILIATION_TOLERANCE,
) {
  const issues: string[] = [];
  const eleDetailAmount = sumItemAmount(payload.eleBills);
  const eleFee = roundMoney(toAmount(payload.eleFee));
  if (Math.abs(eleDetailAmount - eleFee) > tolerance) {
    issues.push(
      buildReconciliationError('电费明细合计', eleFee, eleDetailAmount),
    );
  }

  const waterDetailAmount = sumItemAmount(payload.waterBills);
  const waterFee = roundMoney(toAmount(payload.waterFee));
  if (Math.abs(waterDetailAmount - waterFee) > tolerance) {
    issues.push(
      buildReconciliationError('水费明细合计', waterFee, waterDetailAmount),
    );
  }

  const standardFeeTotal = roundMoney(
    toAmount(payload.eleFee) +
      toAmount(payload.waterFee) +
      toAmount(payload.factoryRent) +
      toAmount(payload.managementFee) +
      toAmount(payload.garbageFee) +
      toAmount(payload.serviceFee) +
      toAmount(payload.invoiceTax) +
      toAmount(payload.penaltyFee),
  );
  const expectedTotal = roundMoney(
    standardFeeTotal + sumExtraFeeItems(payload.extraProjectItem),
  );
  const totalFee = roundMoney(toAmount(payload.totalFee));
  if (Math.abs(expectedTotal - totalFee) > tolerance) {
    issues.push(buildReconciliationError('费用合计', totalFee, expectedTotal));
  }

  return issues;
}

export function validateAndNormalizeAmountBillData(
  billData: Record<string, any>,
  options: { tenantId?: null | number | string } = {},
) {
  const projectName = normalizeText(billData.projectName);
  if (!projectName) {
    return '项目名称不能为空';
  }
  const projectPeriodError = getAmountBillProjectPeriodError(projectName);
  if (projectPeriodError) {
    return projectPeriodError;
  }
  billData.projectName = projectName;

  if (!options.tenantId && !normalizeText(billData.tenantName)) {
    return '租户不能为空';
  }

  const totalFee = Number(billData.totalFee || 0);
  if (!Number.isFinite(totalFee) || totalFee <= 0) {
    return '本月收费金额必须大于0';
  }
  billData.totalFee = totalFee;

  const receiptAmount = Number(billData.receiptAmount || 0);
  if (!Number.isFinite(receiptAmount) || receiptAmount < 0) {
    return '收款金额不能为负数';
  }

  if (receiptAmount === 0) {
    billData.receiptAmount = 0;
    billData.receiptTime = null;
    return null;
  }

  billData.receiptAmount = receiptAmount;
  if (!billData.receiptTime) {
    return '已填写收款金额时，必须填写收款时间';
  }

  return null;
}

export async function resolveAmountBillParkId(
  tx: any,
  params: {
    parkId?: null | number | string;
    tenantId?: null | number | string;
    userinfo?: { id?: number; parks?: Array<{ parkId?: number }> };
  },
) {
  const requestedParkId = toPositiveInteger(params.parkId);
  if (requestedParkId) {
    return requestedParkId;
  }

  const tenantId = toPositiveInteger(params.tenantId);
  if (tenantId) {
    const tenant = await tx.rentalTenant.findUnique({
      select: { parkId: true },
      where: { rentalTenantId: tenantId },
    });
    const tenantParkId = toPositiveInteger(tenant?.parkId);
    if (tenantParkId) {
      return tenantParkId;
    }
  }

  const tokenParkId = params.userinfo?.parks
    ?.map((park) => toPositiveInteger(park?.parkId))
    .find((parkId): parkId is number => parkId !== null);
  if (tokenParkId) {
    return tokenParkId;
  }

  const userId = toPositiveInteger(params.userinfo?.id);
  if (userId) {
    const user = await tx.user.findUnique({
      select: { parkId: true },
      where: { id: userId },
    });
    const userParkId = toPositiveInteger(user?.parkId);
    if (userParkId) {
      return userParkId;
    }
  }

  return null;
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
