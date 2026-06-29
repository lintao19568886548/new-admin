import { randomUUID } from 'node:crypto';

import { normalizeOrganizationIdentityProfile } from '~/utils/customer-identity';
import { verifyAccessToken } from '~/utils/jwt-utils';
import {
  ensureSingleOwnerSourceOrganizationForCenterUser,
  resolveActiveOrganizationMembershipForTargetCustomer,
} from '~/utils/organization';
import {
  badRequestResponse,
  serverErrorResponse,
  unAuthorizedResponse,
  useResponseSuccess,
} from '~/utils/response';
import { issueVipCheckoutFlowToken } from '~/utils/vip-checkout-flow-token';
import {
  buildVipMembershipAttach,
  getOrganizationProvisioningPaymentBlockedMessage,
  getOrganizationProvisioningProfileState,
  isVipMembershipAttach,
  recordVipMembershipPaymentPending,
  resolveVipMembershipAmountTotal,
} from '~/utils/vip-membership';
import { isVipMembershipTestPayment } from '~/utils/vip-membership-test-payment';
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

      let organizationIdentity:
        | ReturnType<typeof normalizeOrganizationIdentityProfile>
        | undefined;
      let sourceOwnedOrganization:
        | Awaited<
            ReturnType<typeof ensureSingleOwnerSourceOrganizationForCenterUser>
          >
        | undefined;
      let paymentSourceOrgId: null | number = null;
      if (customerId === 'public') {
        const organizationIdentityInput =
          normalizeOrganizationIdentityInput(body);
        const existingProvisioningState =
          await getOrganizationProvisioningProfileState(
            centerUserId,
            undefined,
            customerId,
          );
        const provisioningBlockedMessage =
          getOrganizationProvisioningPaymentBlockedMessage(
            existingProvisioningState.organizationProvisioningStatus,
          );
        if (provisioningBlockedMessage) {
          return badRequestResponse(provisioningBlockedMessage, event);
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
              companyShortName:
                existingProvisioningState.targetCompanyShortName,
            };
          }
          sourceOwnedOrganization =
            await ensureSingleOwnerSourceOrganizationForCenterUser({
              centerUserId,
              organizationIdentity: requestedOrganizationIdentity,
              sourceCustomerId: customerId,
            });
          organizationIdentity = normalizeOrganizationIdentityProfile({
            city: sourceOwnedOrganization.organization.city,
            companyShortName:
              sourceOwnedOrganization.organization.companyShortName,
          });
          paymentSourceOrgId = sourceOwnedOrganization.organization.id;
        } catch (error) {
          return badRequestResponse(
            error instanceof Error ? error.message : '组织信息不完整',
            event,
          );
        }
      } else {
        const organizationMembership =
          await resolveActiveOrganizationMembershipForTargetCustomer({
            centerUserId,
            targetCustomerId: customerId,
          });
        if (!organizationMembership) {
          return badRequestResponse('当前空间缺少可续费组织', event);
        }
        if (organizationMembership.memberRole !== 'owner') {
          return badRequestResponse(
            '只有组织所有者可以为该组织开通或续费会员',
            event,
          );
        }
        paymentSourceOrgId = organizationMembership.organization.id;
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
        organizationIdentity,
        rawAttach: attach,
        sourceCustomerId: customerId,
        sourceOrgId: paymentSourceOrgId,
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
