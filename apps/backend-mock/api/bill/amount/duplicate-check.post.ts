import { readBody } from 'h3';
import { prismaClient } from '~/utils/db';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';

import { toPositiveInteger } from './utils';

function normalizeText(value: unknown) {
  return String(value || '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function normalizeAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function buildBillSummary(bill: Record<string, any>) {
  return {
    billId: bill.billId,
    parkId: bill.parkId,
    projectName: bill.projectName || '',
    tenantId: bill.tenantId || null,
    tenantName: bill.tenant?.tenantName || bill.tenantName || '',
    totalFee: normalizeAmount(bill.totalFee),
  };
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = (await readBody(event)) || {};
  const parkId = toPositiveInteger(body.parkId);
  const tenantId = toPositiveInteger(body.tenantId);
  const billId = toPositiveInteger(body.billId);
  const tenantName = normalizeText(body.tenantName);
  const projectName = normalizeText(body.projectName);
  const totalFee = normalizeAmount(body.totalFee);

  if (!parkId) {
    return badRequestResponse('园区不能为空', event);
  }

  if (!tenantId && !tenantName) {
    return badRequestResponse('租户不能为空', event);
  }

  if (!projectName) {
    return badRequestResponse('项目名称不能为空', event);
  }

  try {
    const tenantConditions = [
      ...(tenantId ? [{ tenantId }] : []),
      ...(tenantName ? [{ tenantName }] : []),
    ];
    const where: Record<string, any> = {
      ...(billId ? { billId: { not: billId } } : {}),
      ...(tenantConditions.length > 1
        ? { OR: tenantConditions }
        : tenantConditions[0]),
      parkId,
      projectName,
    };

    const candidates = await prismaClient.amountBill.findMany({
      orderBy: { createTime: 'desc' },
      select: {
        billId: true,
        parkId: true,
        projectName: true,
        tenant: {
          select: {
            tenantName: true,
          },
        },
        tenantId: true,
        tenantName: true,
        totalFee: true,
      },
      take: 20,
      where,
    });

    const similarDuplicates = candidates.map((bill) =>
      buildBillSummary(bill as Record<string, any>),
    );
    const exactDuplicates = similarDuplicates.filter(
      (bill) => Math.abs(normalizeAmount(bill.totalFee) - totalFee) < 0.01,
    );

    return useResponseSuccess({
      exactDuplicates,
      hasExactDuplicate: exactDuplicates.length > 0,
      hasSimilarDuplicate: similarDuplicates.length > 0,
      similarDuplicates,
    });
  } catch (error) {
    console.error('账单重复检查失败:', error);
    return serverErrorResponse('账单重复检查失败', event);
  }
});
