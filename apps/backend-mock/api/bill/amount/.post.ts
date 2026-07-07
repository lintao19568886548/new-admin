import { prismaClient } from '~/utils/db';
import {
  serverErrorResponse,
  useResponseError,
  useResponseSuccess,
} from '~/utils/response';

import {
  resolveAmountBillParkId,
  sanitizeAmountBillPayload,
  toPositiveInteger,
  upsertFinanceRecord,
  validateAmountBillReconciliation,
  validateAndNormalizeAmountBillData,
} from './utils';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }
  const body = await readBody(event);
  const sanitizedBody = sanitizeAmountBillPayload(body || {});
  const {
    eleBills = [],
    parkId: rawParkId,
    source,
    tenantId,
    waterBills = [],
    ...billData
  } = sanitizedBody;
  const isAiImport = source === 'ai-import';
  if (isAiImport && !toPositiveInteger(rawParkId)) {
    return useResponseError('AI导入账单必须选择园区，不能使用默认园区');
  }

  if (isAiImport) {
    const reconciliationErrors = validateAmountBillReconciliation({
      ...billData,
      eleBills,
      waterBills,
    });
    if (reconciliationErrors.length > 0) {
      return useResponseError(reconciliationErrors[0]);
    }
  }

  const validateError = validateAndNormalizeAmountBillData(billData, {
    tenantId,
  });
  if (validateError) {
    return useResponseError(validateError);
  }

  try {
    // 使用事务处理创建操作
    const bill = await prismaClient.$transaction(async (prisma) => {
      const parkId = await resolveAmountBillParkId(prisma, {
        parkId: rawParkId,
        tenantId: isAiImport ? undefined : tenantId,
        userinfo,
      });

      // 1. 创建或更新财务记录
      const financeId = await upsertFinanceRecord(prisma, {
        ...billData,
        parkId,
      });

      // 2. 创建账单及关联数据
      return await prisma.amountBill.create({
        data: {
          ...billData,
          projectName: String(billData.projectName || ''),
          finance: financeId // 使用关联写入
            ? {
                connect: { financeId },
              }
            : undefined,
          park: parkId
            ? {
                connect: { parkId },
              }
            : undefined,
          tenant: tenantId
            ? {
                connect: { rentalTenantId: tenantId },
              }
            : undefined,
          eleBills: {
            create: eleBills,
          },
          waterBills: {
            create: waterBills,
          },
        },
        include: {
          eleBills: true,
          waterBills: true,
        },
      });
    });
    return useResponseSuccess(bill);
  } catch (error) {
    console.error('插入数据失败:', error);
    return serverErrorResponse(`插入数据失败`, event);
  }
});
