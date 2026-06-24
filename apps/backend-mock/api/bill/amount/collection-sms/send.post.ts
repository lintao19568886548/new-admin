import type { AmountBillCollectionSmsCandidate } from '~/utils/amount-bill-collection-sms';

import {
  buildAmountBillCollectionSmsSummary,
  checkAmountBillCollectionSmsTemplateStatuses,
  listAmountBillCollectionSmsCandidates,
  normalizeAmountBillCollectionSmsOptions,
  recordAmountBillCollectionSmsSendResults,
  sendAmountBillCollectionSmsItems,
} from '~/utils/amount-bill-collection-sms';
import { badRequestResponse, useResponseSuccess } from '~/utils/response';
import { getSmsTemplateStatus, sendTemplateSms } from '~/utils/sms-service';

interface AmountBillCollectionSmsSendResult {
  billId: number;
  error?: string;
  parkName?: string;
  phoneNumber?: string;
  projectName: string;
  providerResult?: unknown;
  sendChannel?: 'plain' | 'template';
  smsCompanyName?: string;
  templateId?: string;
  success: boolean;
  tenantName: string;
}

function buildOptionsFromBody(body: Record<string, any>) {
  const filters = { ...body.filters };
  if (body.currentPark !== undefined) {
    filters.currentPark = body.currentPark;
  }

  return normalizeAmountBillCollectionSmsOptions({
    ...body,
    filters,
  });
}

function buildSkippedResult(
  item: AmountBillCollectionSmsCandidate,
): AmountBillCollectionSmsSendResult {
  return {
    billId: item.billId,
    error: item.reason || '账单不可发送催收短信',
    parkName: item.parkName,
    phoneNumber: item.phoneNumber,
    projectName: item.projectName,
    smsCompanyName: item.smsCompanyName,
    success: false,
    tenantName: item.tenantName,
  };
}

function formatTemplateStatusMessage(
  templateCheckResult: Awaited<
    ReturnType<typeof checkAmountBillCollectionSmsTemplateStatuses>
  >,
) {
  const messages = templateCheckResult.unapproved.map((item) => {
    const reason =
      item.status.status === 'rejected' && item.status.refuseReason
        ? `，原因：${item.status.refuseReason}`
        : '';
    return `${item.envName}=${item.status.templateId} ${item.status.statusLabel}${reason}`;
  });
  return messages.join('；');
}

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  const body = ((await readBody(event)) || {}) as Record<string, any>;
  const options = buildOptionsFromBody(body);
  const billIds = options.billIds || [];

  if (billIds.length === 0) {
    return badRequestResponse('请选择要发送催收短信的账单', event);
  }

  const items = await listAmountBillCollectionSmsCandidates({
    event,
    options,
    userinfo,
  });

  const itemMap = new Map(items.map((item) => [item.billId, item]));
  const results: AmountBillCollectionSmsSendResult[] = [];

  const orderedItems = billIds.map((billId) => itemMap.get(billId));
  const sendableItems: AmountBillCollectionSmsCandidate[] = [];

  for (const [index, billId] of billIds.entries()) {
    const item = orderedItems[index];
    if (!item) {
      results.push({
        billId,
        error: '账单不存在、已结清或超出当前权限范围',
        projectName: '',
        success: false,
        tenantName: '',
      });
      continue;
    }

    if (!item.canSend || !item.phoneNumber) {
      results.push(buildSkippedResult(item));
      continue;
    }

    sendableItems.push(item);
  }

  const templateCheckResult =
    await checkAmountBillCollectionSmsTemplateStatuses({
      getTemplateStatus: getSmsTemplateStatus,
      items: sendableItems,
    });
  if (templateCheckResult.missingEnvNames.length > 0) {
    return badRequestResponse(
      `催收短信模板未配置，请先在联麓短信后台报备企业签名模板，并配置 ${templateCheckResult.missingEnvNames.join('、')}。催收类内容不能走普通短信通道，否则可能返回成功但实际不下发。`,
      event,
    );
  }
  if (templateCheckResult.unapproved.length > 0) {
    return badRequestResponse(
      `催收短信模板尚未审核通过，不能发送：${formatTemplateStatusMessage(templateCheckResult)}`,
      event,
    );
  }

  const sendResults = await sendAmountBillCollectionSmsItems({
    items: sendableItems,
    sendTemplateSms,
  });
  results.push(
    ...sendResults.map((result) => ({
      billId: result.billId,
      error: result.error,
      parkName: result.parkName,
      phoneNumber: result.phoneNumber,
      projectName: result.projectName,
      providerResult: result.providerResult,
      sendChannel: 'template' as const,
      smsCompanyName: result.smsCompanyName,
      success: result.success,
      templateId: result.templateId,
      tenantName: result.tenantName,
    })),
  );
  await recordAmountBillCollectionSmsSendResults({
    items: sendableItems,
    results: sendResults,
  });

  const successCount = results.filter((result) => result.success).length;
  const failedCount = results.length - successCount;

  return useResponseSuccess({
    failedCount,
    results,
    successCount,
    summary: buildAmountBillCollectionSmsSummary(items),
    totalCount: results.length,
  });
});
