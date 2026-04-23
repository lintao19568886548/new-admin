import { randomUUID } from 'node:crypto';

import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import {
  buildVipMembershipAttach,
  isVipMembershipAttach,
  recordVipMembershipPaymentPending,
  VIP_MEMBERSHIP_AMOUNT_TOTAL,
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

export default eventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown>;
  const description = String(body.description || '').trim();
  const outTradeNo = `wxapp_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const amount = normalizeAmount(body.amount);
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
    if (rawAttach && isVipMembershipAttach(rawAttach)) {
      const userinfo = await verifyAccessToken(event);
      if (!userinfo) {
        return unAuthorizedResponse(event);
      }

      if (amount !== VIP_MEMBERSHIP_AMOUNT_TOTAL) {
        return badRequestResponse('会员支付金额不正确', event);
      }

      const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
      if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
        return badRequestResponse('缺少中心用户信息，无法创建会员订单', event);
      }

      const customerId = String(
        userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
      );
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
        username: userinfo.username,
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
