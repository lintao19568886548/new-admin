import type { EventHandlerRequest, H3Event } from 'h3';
import type { StringValue } from 'ms';

import jwt from 'jsonwebtoken';

const VIP_CHECKOUT_FLOW_TOKEN_SECRET =
  process.env.VIP_CHECKOUT_FLOW_TOKEN_SECRET ||
  process.env.ACCESS_TOKEN_SECRET ||
  'vip-checkout-flow-secret';
const VIP_CHECKOUT_FLOW_TOKEN_EXPIRES_IN: number | StringValue =
  (process.env.VIP_CHECKOUT_FLOW_TOKEN_EXPIRES_IN as StringValue | undefined) ||
  '15m';
const VIP_CHECKOUT_FLOW_TOKEN_HEADER = 'x-vip-checkout-flow-token';
const VIP_CHECKOUT_FLOW_TOKEN_TYPE = 'vip_checkout_flow';

export interface VipCheckoutFlowTokenPayload {
  centerUserId: number;
  outTradeNo: string;
  sourceCustomerId: string;
  type: 'vip_checkout_flow';
}

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function normalizeString(value: unknown) {
  return String(value || '').trim();
}

export function issueVipCheckoutFlowToken(input: {
  centerUserId: number;
  outTradeNo: string;
  sourceCustomerId: string;
}) {
  return jwt.sign(
    {
      centerUserId: input.centerUserId,
      outTradeNo: input.outTradeNo,
      sourceCustomerId: input.sourceCustomerId,
      type: VIP_CHECKOUT_FLOW_TOKEN_TYPE,
    } satisfies VipCheckoutFlowTokenPayload,
    VIP_CHECKOUT_FLOW_TOKEN_SECRET,
    {
      expiresIn: VIP_CHECKOUT_FLOW_TOKEN_EXPIRES_IN,
    },
  );
}

export function getVipCheckoutFlowTokenFromEvent(
  event: H3Event<EventHandlerRequest>,
) {
  return normalizeString(getHeader(event, VIP_CHECKOUT_FLOW_TOKEN_HEADER));
}

export function verifyVipCheckoutFlowToken(
  token: string,
): null | VipCheckoutFlowTokenPayload {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, VIP_CHECKOUT_FLOW_TOKEN_SECRET);
    if (typeof decoded !== 'object' || !decoded) {
      return null;
    }

    const centerUserId = normalizePositiveInteger(
      (decoded as Record<string, unknown>).centerUserId,
    );
    const outTradeNo = normalizeString(
      (decoded as Record<string, unknown>).outTradeNo,
    );
    const sourceCustomerId = normalizeString(
      (decoded as Record<string, unknown>).sourceCustomerId,
    );
    const type = normalizeString((decoded as Record<string, unknown>).type);

    if (
      !centerUserId ||
      !outTradeNo ||
      !sourceCustomerId ||
      type !== VIP_CHECKOUT_FLOW_TOKEN_TYPE
    ) {
      return null;
    }

    return {
      centerUserId,
      outTradeNo,
      sourceCustomerId,
      type: VIP_CHECKOUT_FLOW_TOKEN_TYPE,
    };
  } catch (error) {
    console.warn('VIP checkout flow token 验证失败:', error);
    return null;
  }
}

export function verifyVipCheckoutFlowTokenFromEvent(
  event: H3Event<EventHandlerRequest>,
) {
  return verifyVipCheckoutFlowToken(getVipCheckoutFlowTokenFromEvent(event));
}
