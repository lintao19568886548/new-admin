import { randomUUID } from 'node:crypto';

import { normalizeTenantIdentityProfile } from '~/utils/customer-identity';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { issueVipCheckoutFlowToken } from '~/utils/vip-checkout-flow-token';
import {
  buildVipMembershipAttach,
  getTenantProvisioningPaymentBlockedMessage,
  getTenantProvisioningProfileState,
  isVipMembershipAttach,
  isVipMembershipTestPayment,
  recordVipMembershipPaymentPending,
  resolveVipMembershipAmountTotal,
} from '~/utils/vip-membership';
import { createWechatAppPrepay } from '~/utils/wechat-pay';

function normalizeAmount(value: unknown) {
  const total = Number(value);
  if (!Number.isInteger(total) || total <= 0) {
    return null;
  }
  return total;
}

function normalizeOptionalString(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeTenantIdentityInput(body: Record<string, unknown>) {
  const nested =
    body.tenantIdentity &&
    typeof body.tenantIdentity === 'object' &&
    !Array.isArray(body.tenantIdentity)
      ? (body.tenantIdentity as Record<string, unknown>)
      : {};

  return {
    city: nested.city ?? body.tenantCity,
    companyShortName:
      nested.companyShortName ??
      nested.companyName ??
      body.tenantCompanyShortName ??
      body.tenantCompanyName,
  };
}

function hasTenantIdentityInput(input: {
  city?: unknown;
  companyShortName?: unknown;
}) {
  return (
    Boolean(String(input.city ?? '').trim()) ||
    Boolean(String(input.companyShortName ?? '').trim())
  );
}

export default eventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>;
  const description = String(body.description || '').trim();
  const outTradeNo = `wxapp_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  let amount = normalizeAmount(body.amount);
  const currency = normalizeOptionalString(body.currency) || 'CNY';
  const rawAttach = normalizeOptionalString(body.attach);

  if (!description) {
    return badRequestResponse('支付描述不能为空', event);
  }

  if (!amount) {
    return badRequestResponse('支付金额必须为大于 0 的整数分', event);
  }

  try {
    let attach = rawAttach;
    let checkoutFlowToken: null | string = null;
    if (rawAttach && isVipMembershipAttach(rawAttach)) {
      const userinfo = await verifyAccessToken(event);
      if (!userinfo) {
        return unAuthorizedResponse(event);
      }

      const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
      if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
        return badRequestResponse('缺少中心用户信息，无法创建会员订单', event);
      }

      const customerId = String(
        userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
      );
      const amountContext = {
        centerUserId,
        sourceCustomerId: customerId,
        tenantUserId: userinfo.id,
      };
      const expectedAmount = resolveVipMembershipAmountTotal(amountContext);
      if (amount !== expectedAmount) {
        if (!isVipMembershipTestPayment(amountContext)) {
          return badRequestResponse('会员支付金额不正确', event);
        }
        amount = expectedAmount;
      }

      let tenantIdentity:
        | ReturnType<typeof normalizeTenantIdentityProfile>
        | undefined;
      if (customerId === 'public') {
        const tenantIdentityInput = normalizeTenantIdentityInput(body);
        const existingProvisioningState =
          await getTenantProvisioningProfileState(centerUserId);
        const provisioningBlockedMessage =
          getTenantProvisioningPaymentBlockedMessage(
            existingProvisioningState.tenantProvisioningStatus,
          );
        if (provisioningBlockedMessage) {
          return badRequestResponse(provisioningBlockedMessage, event);
        }
        const canReuseExistingIdentity = Boolean(
          existingProvisioningState.targetCity &&
          existingProvisioningState.targetCompanyShortName,
        );

        try {
          tenantIdentity =
            hasTenantIdentityInput(tenantIdentityInput) ||
            !canReuseExistingIdentity
              ? normalizeTenantIdentityProfile(tenantIdentityInput)
              : undefined;
        } catch (error) {
          return badRequestResponse(
            error instanceof Error ? error.message : '专属空间信息不完整',
            event,
          );
        }
      }
      attach = buildVipMembershipAttach({
        centerUserId,
        customerId,
        userId: userinfo.id,
      });

      await recordVipMembershipPaymentPending({
        amountTotal: amount,
        centerUserId,
        outTradeNo,
        rawAttach: attach,
        sourceCustomerId: customerId,
        tenantIdentity,
        username: userinfo.username,
      });

      checkoutFlowToken = issueVipCheckoutFlowToken({
        centerUserId,
        outTradeNo,
        sourceCustomerId: customerId,
      });
    }

    const payerClientIp =
      getRequestIP(event, { xForwardedFor: true }) ||
      getHeader(event, 'x-real-ip') ||
      getHeader(event, 'cf-connecting-ip') ||
      '127.0.0.1';

    const result = await createWechatAppPrepay({
      amount: {
        currency,
        total: amount,
      },
      attach,
      description,
      deviceId: normalizeOptionalString(body.deviceId),
      outTradeNo,
      payerClientIp,
    });

    return useResponseSuccess({
      checkoutFlowToken: checkoutFlowToken || undefined,
      launchParams: result.launchParams,
      prepayId: result.prepayId,
    });
  } catch (error) {
    console.error('创建微信 APP 预支付订单失败:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : '创建微信 APP 预支付订单失败',
      event,
    );
  }
});
