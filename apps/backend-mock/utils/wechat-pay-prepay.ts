import type { EventHandlerRequest, H3Event } from 'h3';

import { randomUUID } from 'node:crypto';

import { normalizeOrganizationIdentityProfile } from '~/utils/customer-identity';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  ensureSingleOwnerSourceOrganizationForCenterUser,
  resolveActiveOrganizationMembershipForTargetCustomer,
} from '~/utils/organization';
import { badRequestResponse, unAuthorizedResponse } from '~/utils/response';
import { issueVipCheckoutFlowToken } from '~/utils/vip-checkout-flow-token';
import {
  buildVipMembershipAttach,
  getOrganizationProvisioningPaymentBlockedMessage,
  getOrganizationProvisioningProfileState,
  isVipMembershipAttach,
  normalizeVipMembershipPlanId,
  recordVipMembershipPaymentPending,
  resolveVipMembershipAmountTotal,
  resolveVipMembershipSourceCustomerId,
} from '~/utils/vip-membership';
import { isVipMembershipTestPayment } from '~/utils/vip-membership-test-payment';

export interface WechatPrepayContext {
  amount: number;
  attach?: string;
  checkoutFlowToken?: string;
  currency: string;
  description: string;
  outTradeNo: string;
  payerClientIp: string;
  planId: 'monthly' | 'quarterly' | 'yearly';
}

function normalizeAmount(value: unknown) {
  const total = Number(value);
  if (!Number.isInteger(total) || total <= 0) {
    return null;
  }
  return total;
}

export function normalizeOptionalString(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizeOrganizationIdentityInput(body: Record<string, unknown>) {
  let nested: Record<string, unknown> = {};
  if (
    body.organizationIdentity &&
    typeof body.organizationIdentity === 'object' &&
    !Array.isArray(body.organizationIdentity)
  ) {
    nested = body.organizationIdentity as Record<string, unknown>;
  }

  return {
    city: nested.city ?? body.organizationCity,
    companyShortName:
      nested.companyShortName ??
      nested.companyName ??
      body.organizationCompanyShortName ??
      body.organizationCompanyName,
  };
}

function hasOrganizationIdentityInput(input: {
  city?: unknown;
  companyShortName?: unknown;
}) {
  return (
    Boolean(String(input.city ?? '').trim()) ||
    Boolean(String(input.companyShortName ?? '').trim())
  );
}

export function resolvePayerClientIp(event: H3Event<EventHandlerRequest>) {
  return (
    getRequestIP(event, { xForwardedFor: true }) ||
    getHeader(event, 'x-real-ip') ||
    getHeader(event, 'cf-connecting-ip') ||
    '127.0.0.1'
  );
}

export async function createWechatPrepayContext(
  event: H3Event<EventHandlerRequest>,
  body: Record<string, unknown>,
  tradePrefix: string,
): Promise<
  | {
      context: WechatPrepayContext;
      response?: never;
    }
  | {
      context?: never;
      response: ReturnType<typeof badRequestResponse>;
    }
> {
  const description = String(body.description || '').trim();
  const outTradeNo = `${tradePrefix}_${Date.now()}_${randomUUID()
    .replaceAll('-', '')
    .slice(0, 12)}`;
  let amount = normalizeAmount(body.amount);
  const currency = normalizeOptionalString(body.currency) || 'CNY';
  const rawAttach = normalizeOptionalString(body.attach);
  const planId = normalizeVipMembershipPlanId(body.planId);

  if (!description) {
    return {
      response: badRequestResponse('支付描述不能为空', event),
    };
  }

  if (!amount) {
    return {
      response: badRequestResponse('支付金额必须为大于 0 的整数分', event),
    };
  }

  let attach = rawAttach;
  let checkoutFlowToken: string | undefined;
  if (rawAttach && isVipMembershipAttach(rawAttach)) {
    const userinfo = await verifyAccessToken(event);
    if (!userinfo) {
      return {
        response: unAuthorizedResponse(event),
      };
    }

    const centerUserId = Number(userinfo.centerUserId ?? userinfo.id);
    if (!Number.isFinite(centerUserId) || centerUserId <= 0) {
      return {
        response: badRequestResponse(
          '缺少中心用户信息，无法创建会员订单',
          event,
        ),
      };
    }

    const customerId = String(
      userinfo.customerId || process.env.DEFAULT_CUSTOMER_ID || 'default',
    );
    const paymentSourceCustomerId =
      resolveVipMembershipSourceCustomerId(customerId);
    const amountContext = {
      centerUserId,
      sourceCustomerId: paymentSourceCustomerId,
      tenantUserId: userinfo.id,
    };
    const expectedAmount = resolveVipMembershipAmountTotal(
      amountContext,
      planId,
    );
    if (amount !== expectedAmount) {
      if (!isVipMembershipTestPayment(amountContext)) {
        return {
          response: badRequestResponse('会员支付金额不正确', event),
        };
      }
      amount = expectedAmount;
    }

    let organizationIdentity:
      | ReturnType<typeof normalizeOrganizationIdentityProfile>
      | undefined;
    let sourceOwnedOrganization:
      | Awaited<
          ReturnType<typeof ensureSingleOwnerSourceOrganizationForCenterUser>
        >
      | undefined;
    let paymentSourceOrgId: null | number = null;
    if (paymentSourceCustomerId === 'public') {
      const organizationIdentityInput =
        normalizeOrganizationIdentityInput(body);
      const existingProvisioningState =
        await getOrganizationProvisioningProfileState(
          centerUserId,
          undefined,
          paymentSourceCustomerId,
        );
      const provisioningBlockedMessage =
        getOrganizationProvisioningPaymentBlockedMessage(
          existingProvisioningState.organizationProvisioningStatus,
        );
      if (provisioningBlockedMessage) {
        return {
          response: badRequestResponse(provisioningBlockedMessage, event),
        };
      }
      const canReuseExistingIdentity = Boolean(
        existingProvisioningState.targetCity &&
        existingProvisioningState.targetCompanyShortName,
      );

      try {
        let requestedOrganizationIdentity:
          | undefined
          | {
              city?: unknown;
              companyShortName?: unknown;
            };
        if (hasOrganizationIdentityInput(organizationIdentityInput)) {
          requestedOrganizationIdentity = organizationIdentityInput;
        } else if (canReuseExistingIdentity) {
          requestedOrganizationIdentity = {
            city: existingProvisioningState.targetCity,
            companyShortName: existingProvisioningState.targetCompanyShortName,
          };
        }
        sourceOwnedOrganization =
          await ensureSingleOwnerSourceOrganizationForCenterUser({
            centerUserId,
            organizationIdentity: requestedOrganizationIdentity,
            sourceCustomerId: paymentSourceCustomerId,
          });
        organizationIdentity = normalizeOrganizationIdentityProfile({
          city: sourceOwnedOrganization.organization.city,
          companyShortName:
            sourceOwnedOrganization.organization.companyShortName,
        });
        paymentSourceOrgId = sourceOwnedOrganization.organization.id;
      } catch (error) {
        return {
          response: badRequestResponse(
            error instanceof Error ? error.message : '组织信息不完整',
            event,
          ),
        };
      }
    } else {
      const organizationMembership =
        await resolveActiveOrganizationMembershipForTargetCustomer({
          centerUserId,
          targetCustomerId: paymentSourceCustomerId,
        });
      if (!organizationMembership) {
        return {
          response: badRequestResponse('当前空间缺少可续费组织', event),
        };
      }
      if (organizationMembership.memberRole !== 'owner') {
        return {
          response: badRequestResponse(
            '只有组织所有者可以为该组织开通或续费会员',
            event,
          ),
        };
      }
      paymentSourceOrgId = organizationMembership.organization.id;
    }

    attach = buildVipMembershipAttach({
      centerUserId,
      customerId: paymentSourceCustomerId,
      planId,
      userId: userinfo.id,
    });

    await recordVipMembershipPaymentPending({
      amountTotal: amount,
      centerUserId,
      outTradeNo,
      organizationIdentity,
      rawAttach: attach,
      sourceCustomerId: paymentSourceCustomerId,
      sourceOrgId: paymentSourceOrgId,
      username: userinfo.username,
    });

    checkoutFlowToken = issueVipCheckoutFlowToken({
      centerUserId,
      outTradeNo,
      sourceCustomerId: paymentSourceCustomerId,
    });
  }

  return {
    context: {
      amount,
      attach,
      checkoutFlowToken,
      currency,
      description,
      outTradeNo,
      payerClientIp: resolvePayerClientIp(event),
      planId,
    },
  };
}
