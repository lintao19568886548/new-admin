export interface VipMembershipTestPaymentContext {
  centerUserId?: unknown;
  sourceCustomerId?: unknown;
  tenantUserId?: unknown;
}

// 临时联调开关集中放这里；测试完把 enabled 改回 false，避免生产误用。
export const VIP_MEMBERSHIP_TEST_PAYMENT_OVERRIDE = {
  amountTotal: 1,
  enabled: true,
  sourceCustomerId: 'public',
  tenantUserId: 68,
} as const;

function normalizePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }
  return numberValue;
}

function normalizeString(value: unknown) {
  if (typeof value !== 'string') {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }
  return value.trim();
}

function resolveVipMembershipTestPaymentOverride(
  context?: VipMembershipTestPaymentContext,
) {
  if (!VIP_MEMBERSHIP_TEST_PAYMENT_OVERRIDE.enabled || !context) {
    return null;
  }

  const sourceCustomerId = normalizeString(context.sourceCustomerId);
  const tenantUserId = normalizePositiveInteger(context.tenantUserId);
  if (
    sourceCustomerId ===
      VIP_MEMBERSHIP_TEST_PAYMENT_OVERRIDE.sourceCustomerId &&
    tenantUserId === VIP_MEMBERSHIP_TEST_PAYMENT_OVERRIDE.tenantUserId
  ) {
    return VIP_MEMBERSHIP_TEST_PAYMENT_OVERRIDE;
  }

  return null;
}

export function isVipMembershipTestPayment(
  context?: VipMembershipTestPaymentContext,
) {
  return Boolean(resolveVipMembershipTestPaymentOverride(context));
}

export function resolveVipMembershipTestPaymentAmountTotal(
  context?: VipMembershipTestPaymentContext,
) {
  return resolveVipMembershipTestPaymentOverride(context)?.amountTotal ?? null;
}
