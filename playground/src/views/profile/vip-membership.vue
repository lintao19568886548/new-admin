<script lang="ts" setup>
import type {
  OrganizationProvisioningStatus,
  WechatPayOrderStatus,
} from '#/api/wechat-pay';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, Checkbox, Input, message, Modal, Tag } from 'ant-design-vue';

import { createSourceOrganizationApi } from '#/api/organization';
import { joinOrganizationByInvitationCodeApi } from '#/api/organization-invitation';
import { getOrganizationProvisioningStatus } from '#/api/wechat-pay';
import { useAuthStore } from '#/store';
import { resolveMembershipAccessState } from '#/utils/membership-access';
import {
  canUseNativeWechatPay,
  isWechatInstalled,
  payWithWechatApp,
} from '#/utils/native-wechat-pay';
import {
  openPrivacyPolicyDialog,
  openServiceAgreementDialog,
} from '#/utils/policy-actions';
import { loadWechatPayAppConfig } from '#/utils/wechat-pay-app-config';

defineOptions({ name: 'VipMembershipPage' });

const MEMBERSHIP_AMOUNT_FEN = 98_000;
const PAY_MESSAGE_KEY = 'vip-membership-pay';
const ORDER_PENDING_STATES = new Set(['NOTPAY', 'USERPAYING']);
const ORGANIZATION_PROVISIONING_PENDING_STATES = new Set([
  'pending',
  'provisioning',
]);
const ORGANIZATION_PROVISIONING_FAILED_STATES = new Set([
  'failed_manual',
  'failed_retryable',
]);
const ORGANIZATION_PROVISIONING_PAYMENT_BLOCKED_STATES = new Set([
  'pending',
  'provisioning',
  ...ORGANIZATION_PROVISIONING_FAILED_STATES,
]);

const membershipPlan = {
  name: '组织会员月度服务',
  originalPrice: 1280,
  period: '月',
  price: MEMBERSHIP_AMOUNT_FEN / 100,
  savings: 300,
};
const RESTRICTED_PAGE_LABEL = '租赁管理、人员信息';

const benefitItems = [
  {
    description: '组织会员有效期内，组织成员可使用对应定位能力。',
    icon: 'mdi:map-marker-radius-outline',
    title: '定位服务',
  },
  {
    description: '开放组织招商相关能力入口。',
    icon: 'mdi:radar',
    title: '招商雷达',
  },
  {
    description: '支付完成后自动返回当前页面。',
    icon: 'mdi:flash-outline',
    title: '结果回页',
  },
  {
    description: '保留最近订单号，便于付款排查。',
    icon: 'mdi:receipt-text-outline',
    title: '订单可追踪',
  },
] as const;

interface MembershipPaymentState {
  outTradeNo: string;
  success: boolean;
  tradeState: string;
  tradeStateDesc: string;
  transactionId?: string;
}

interface ProfileMembershipState {
  active: boolean;
  expireAt?: string;
  label: string;
  sourceField?: string;
}

interface ProfileOrganizationProvisioningState {
  label: string;
  status: string;
  targetCustomerId?: string;
}

interface SourceOrganizationState {
  city?: string;
  companyShortName?: string;
  id: number;
  memberRole: string;
  name: string;
  sourceCustomerId: string;
}

type MembershipCheckoutResult = 'failed' | 'ready' | 'syncing' | 'unknown';

interface CheckoutResultModalView {
  description: string;
  heading: string;
  icon: string;
  okText: string;
  title: string;
  tone: 'pending' | 'success' | 'warning';
}

const CHECKOUT_RESULT_MODAL_VIEW_MAP: Record<
  MembershipCheckoutResult,
  CheckoutResultModalView
> = {
  failed: {
    description: '组织空间开通未完成。请联系客服处理。',
    heading: '组织空间暂未开通',
    icon: 'mdi:alert-circle-outline',
    okText: '重新登录查看',
    title: '支付成功，开通异常',
    tone: 'warning',
  },
  ready: {
    description:
      '组织会员与组织空间已完成开通。重新登录后会进入新的组织空间，并加载最新权限与菜单。',
    heading: '组织空间开通成功',
    icon: 'mdi:check-decagram',
    okText: '重新登录',
    title: '组织会员已开通',
    tone: 'success',
  },
  syncing: {
    description:
      '微信支付已完成，后台正在完成组织空间开通。稍后可重新登录查看最新状态。',
    heading: '组织空间正在完成开通',
    icon: 'mdi:progress-clock',
    okText: '重新登录查看',
    title: '支付成功',
    tone: 'pending',
  },
  unknown: {
    description:
      '微信支付已完成，组织会员状态正在同步。稍后可重新登录或刷新查看最新状态。',
    heading: '支付结果已确认',
    icon: 'mdi:check-circle-outline',
    okText: '重新登录查看',
    title: '支付成功',
    tone: 'success',
  },
};

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();

const agreedToTerms = ref(false);
const agreementModalOpen = ref(false);
const checkoutResultModalOpen = ref(false);
const membershipCheckoutResult = ref<MembershipCheckoutResult>('unknown');
const organizationCity = ref('');
const organizationCompanyShortName = ref('');
const organizationCreateLoading = ref(false);
const organizationIdentityTouched = ref(false);
const organizationInvitationCode = ref('');
const organizationInvitationTouched = ref(false);
const organizationJoinLoading = ref(false);
const payLoading = ref(false);
const wechatConfigLoading = ref(false);
const latestPaymentState = ref<MembershipPaymentState | null>(null);
const latestOrganizationProvisioningStatus =
  ref<null | OrganizationProvisioningStatus>(null);
const paymentSectionRef = ref<HTMLElement | null>(null);
const organizationSetupRef = ref<HTMLElement | null>(null);
const wechatOpenAppId = ref('');
const wechatPayConfigError = ref('');
const wechatPayMerchantId = ref('');
const wechatPayConfigured = ref(false);
const wechatPayMissingConfig = ref<string[]>([]);

const userInfo = computed(() => userStore.userInfo);
const membershipAccessState = computed(() =>
  resolveMembershipAccessState(
    userInfo.value as null | Record<string, unknown> | undefined,
  ),
);
const checkoutResultModalView = computed(
  () => CHECKOUT_RESULT_MODAL_VIEW_MAP[membershipCheckoutResult.value],
);
const currentCustomerId = computed(() =>
  typeof userInfo.value?.customerId === 'string'
    ? userInfo.value.customerId.trim()
    : '',
);
const customerCompanyShortName = computed(() => {
  const record = userInfo.value as Record<string, unknown> | undefined;
  return record
    ? readStringField(record, ['customerCompanyShortName', 'companyShortName'])
        ?.value || ''
    : '';
});
const customerName = computed(() => {
  const record = userInfo.value as Record<string, unknown> | undefined;
  return record ? readStringField(record, ['customerName'])?.value || '' : '';
});
const backButtonLabel = computed(() =>
  membershipAccessState.value.accessRestricted
    ? '前往租赁管理'
    : '返回个人中心',
);
const latestPaymentStatusLabel = computed(() => {
  if (!latestPaymentState.value) {
    return '暂无支付记录';
  }

  if (latestPaymentState.value.success) {
    return latestPaymentState.value.tradeStateDesc || '支付成功';
  }

  return (
    latestPaymentState.value.tradeStateDesc ||
    latestPaymentState.value.tradeState
  );
});
const isSuperUser = computed(() =>
  (userInfo.value?.roles || []).some((role) => String(role) === 'Super'),
);
const profileMembershipState = computed<null | ProfileMembershipState>(() =>
  resolveProfileMembershipState(userInfo.value),
);
const postPaymentMembershipExpireLabel = computed(() => {
  const currentExpireAt = profileMembershipState.value?.expireAt
    ? new Date(profileMembershipState.value.expireAt)
    : null;
  const now = new Date();
  const baseTime =
    currentExpireAt &&
    !Number.isNaN(currentExpireAt.getTime()) &&
    currentExpireAt.getTime() > now.getTime()
      ? currentExpireAt
      : now;

  return `预计至 ${formatMembershipExpireAt(addMonths(baseTime, 1).toISOString())}`;
});
const profileOrganizationProvisioningState =
  computed<null | ProfileOrganizationProvisioningState>(() =>
    resolveProfileOrganizationProvisioningState(
      latestOrganizationProvisioningStatus.value || userInfo.value,
    ),
  );
const sourceOrganizationState = computed<null | SourceOrganizationState>(() =>
  resolveSourceOrganizationState(
    latestOrganizationProvisioningStatus.value || userInfo.value,
  ),
);
const sourceOrganizationCount = computed(() => {
  const record = (latestOrganizationProvisioningStatus.value ||
    userInfo.value) as Record<string, unknown> | undefined;
  const count = Number(record?.sourceOrganizationCount ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
});
const hasAnySourceOrganization = computed(
  () =>
    Boolean(sourceOrganizationState.value) || sourceOrganizationCount.value > 0,
);
const sourceOrganizationConflict = computed(
  () =>
    currentCustomerId.value === 'public' &&
    !sourceOrganizationState.value &&
    sourceOrganizationCount.value > 1,
);
const sourceOrganizationIdentityComplete = computed(
  () =>
    Boolean(sourceOrganizationState.value?.city?.trim()) &&
    Boolean(sourceOrganizationState.value?.companyShortName?.trim()),
);
const sourceOrganizationPaymentAllowed = computed(
  () =>
    !sourceOrganizationState.value ||
    sourceOrganizationState.value.memberRole === 'owner',
);
const requiresOrganizationIdentity = computed(
  () =>
    currentCustomerId.value === 'public' &&
    !sourceOrganizationIdentityComplete.value &&
    (!hasAnySourceOrganization.value ||
      Boolean(sourceOrganizationState.value)) &&
    !profileOrganizationProvisioningState.value,
);
const canCreateSourceOrganization = computed(
  () =>
    currentCustomerId.value === 'public' &&
    !hasAnySourceOrganization.value &&
    !profileOrganizationProvisioningState.value,
);
const canSaveSourceOrganizationIdentity = computed(
  () =>
    currentCustomerId.value === 'public' &&
    Boolean(sourceOrganizationState.value) &&
    sourceOrganizationState.value?.memberRole === 'owner' &&
    !sourceOrganizationIdentityComplete.value &&
    !profileOrganizationProvisioningState.value,
);
const canSetupSourceOrganization = computed(
  () =>
    canCreateSourceOrganization.value ||
    canSaveSourceOrganizationIdentity.value,
);
const membershipScopeName = computed(() => {
  const companyShortName = (
    requiresOrganizationIdentity.value
      ? organizationCompanyShortName.value
      : sourceOrganizationState.value?.companyShortName ||
        customerCompanyShortName.value ||
        organizationCompanyShortName.value
  ).trim();
  if (requiresOrganizationIdentity.value) {
    return companyShortName ? `${companyShortName} 组织空间` : '待开通组织空间';
  }

  if (sourceOrganizationState.value) {
    return companyShortName
      ? `${companyShortName} 组织空间`
      : sourceOrganizationState.value.name;
  }

  if (currentCustomerId.value === 'public') {
    return '公共试用空间';
  }

  if (currentCustomerId.value === 'default') {
    return '默认空间';
  }

  if (companyShortName) {
    return `${companyShortName} 组织空间`;
  }

  if (customerName.value) {
    return `${customerName.value} 组织空间`;
  }

  return '当前组织空间';
});
const canJoinExistingOrganization = computed(
  () => canCreateSourceOrganization.value,
);
const organizationInvitationError = computed(() => {
  if (!canJoinExistingOrganization.value) {
    return '';
  }

  if (!organizationInvitationCode.value.trim()) {
    return '请输入组织邀请码';
  }

  return '';
});
const organizationIdentityError = computed(() => {
  if (!requiresOrganizationIdentity.value) {
    return '';
  }

  if (!organizationCity.value.trim()) {
    return '请填写 组织/公司 所在城市';
  }

  if (!organizationCompanyShortName.value.trim()) {
    return '请填写 组织/公司 简称';
  }

  return '';
});
const organizationIdentityReady = computed(
  () => !organizationIdentityError.value,
);
const organizationProvisioningPaymentBlocked = computed(() => {
  const status = profileOrganizationProvisioningState.value?.status;
  return Boolean(
    status && ORGANIZATION_PROVISIONING_PAYMENT_BLOCKED_STATES.has(status),
  );
});
const wechatPayConfigReady = computed(
  () =>
    wechatPayConfigured.value &&
    Boolean(wechatOpenAppId.value) &&
    Boolean(wechatPayMerchantId.value),
);
const appPaySupported = computed(
  () => wechatPayConfigReady.value && canUseNativeWechatPay(),
);
const wechatPayRuntimeState = computed(() => {
  if (wechatConfigLoading.value) {
    return {
      description: '正在读取后端微信支付 AppID 与商户号。',
      icon: 'mdi:loading',
      title: '支付配置读取中',
      tone: 'processing',
    };
  }

  if (wechatPayConfigError.value) {
    return {
      description: wechatPayConfigError.value,
      icon: 'mdi:alert-circle-outline',
      title: '支付配置待完善',
      tone: 'warning',
    };
  }

  if (!wechatPayConfigReady.value) {
    return {
      description: '后端尚未返回微信支付 AppID 或商户号。',
      icon: 'mdi:alert-circle-outline',
      title: '微信支付未配置',
      tone: 'warning',
    };
  }

  if (!canUseNativeWechatPay()) {
    return {
      description: '浏览器预览可查看页面，支付需在 Android App 内完成。',
      icon: 'mdi:cellphone-link',
      title: '请在 App 内支付',
      tone: 'muted',
    };
  }

  if (!isWechatInstalled(wechatOpenAppId.value)) {
    return {
      description: '当前设备未检测到微信客户端。',
      icon: 'mdi:wechat',
      title: '未检测到微信',
      tone: 'warning',
    };
  }

  return {
    description: '当前设备支持拉起微信 App 支付。',
    icon: 'mdi:check-circle-outline',
    title: '微信支付可用',
    tone: 'success',
  };
});
const payButtonText = computed(() => {
  if (payLoading.value) {
    return '正在处理支付...';
  }

  if (wechatConfigLoading.value) {
    return '正在读取支付配置...';
  }

  if (!wechatPayConfigReady.value) {
    return wechatPayConfigError.value ? '支付配置待完善' : '未配置微信支付';
  }

  if (!appPaySupported.value) {
    return '仅支持 Android App';
  }

  if (organizationProvisioningPaymentBlocked.value) {
    return (
      profileOrganizationProvisioningState.value?.label || '组织空间开通中'
    );
  }

  if (sourceOrganizationConflict.value) {
    return '请选择一个组织';
  }

  if (!sourceOrganizationPaymentAllowed.value) {
    return '仅组织所有者可支付';
  }

  if (!organizationIdentityReady.value) {
    return '填写组织信息';
  }

  return `微信支付 ¥${membershipPlan.price}`;
});
const payButtonDisabled = computed(
  () =>
    payLoading.value ||
    wechatConfigLoading.value ||
    organizationCreateLoading.value ||
    organizationProvisioningPaymentBlocked.value ||
    sourceOrganizationConflict.value ||
    !sourceOrganizationPaymentAllowed.value ||
    !organizationIdentityReady.value ||
    !wechatPayConfigReady.value ||
    !appPaySupported.value,
);
const paymentAgreementHint = computed(() => {
  if (wechatPayConfigError.value) {
    return wechatPayConfigError.value;
  }

  if (!wechatPayConfigReady.value) {
    return '微信支付需要后端返回开放平台移动应用 AppID 和微信支付商户号。';
  }

  if (!appPaySupported.value) {
    return '当前浏览器仅用于预览页面，实际支付请在 Android App 内打开。';
  }

  if (organizationProvisioningPaymentBlocked.value) {
    return (
      profileOrganizationProvisioningState.value?.label ||
      '组织空间正在开通中，请勿重复支付。'
    );
  }

  if (sourceOrganizationConflict.value) {
    return '当前账号绑定多个组织，请先联系管理员确认要开通或续费的组织。';
  }

  if (!sourceOrganizationPaymentAllowed.value) {
    return '当前账号是组织成员，只有组织所有者可以为该组织开通或续费会员。';
  }

  if (agreedToTerms.value) {
    return '已同意《会员服务协议》和《隐私政策》。';
  }

  if (requiresOrganizationIdentity.value) {
    return '可先免费创建组织空间；直接支付时也会使用这份组织信息。';
  }

  return '支付前请先阅读并勾选相关协议。';
});

watch(
  [userInfo, latestOrganizationProvisioningStatus],
  ([currentUserInfo, currentProvisioningStatus]) => {
    applyOrganizationIdentityDraft(
      currentProvisioningStatus || currentUserInfo,
    );
  },
  { immediate: true },
);

const membershipGateNotice = computed(() => {
  const accessState = membershipAccessState.value;
  const queryReason =
    typeof route.query.reason === 'string' ? route.query.reason.trim() : '';
  const hasQueryReason =
    queryReason === 'membership_expired' || queryReason === 'trial_expired';
  if (
    ['default_exempt', 'member_active', 'trial_active'].includes(
      accessState.accessScopeStatus,
    )
  ) {
    return null;
  }
  let reason: 'membership_expired' | 'none' | 'trial_expired' = 'none';
  if (accessState.accessRestricted) {
    reason = accessState.membershipGateReason;
  } else if (hasQueryReason) {
    reason = queryReason;
  }
  if (reason !== 'membership_expired' && reason !== 'trial_expired') {
    return null;
  }

  if (reason === 'membership_expired') {
    return {
      description:
        '当前组织仍保留数据和成员关系，但除租赁管理和人员信息外的页面已限制访问。续费组织会员后恢复全部功能。',
      eyebrow: 'Membership Expired',
      title: '组织会员已过期',
    };
  }

  return {
    description:
      '免费试用期已结束，目前仅保留租赁管理和人员信息两个页面可用。开通组织会员后恢复全部功能。',
    eyebrow: 'Trial Ended',
    title: '试用已到期',
  };
});
const orderStatusTag = computed(() => {
  if (profileOrganizationProvisioningState.value) {
    const status = profileOrganizationProvisioningState.value.status;
    return {
      color: resolveOrganizationProvisioningTagColor(status),
      text: profileOrganizationProvisioningState.value.label,
    };
  }

  if (profileMembershipState.value?.active) {
    return {
      color: 'success',
      text: profileMembershipState.value.label,
    };
  }

  if (payLoading.value) {
    return {
      color: 'processing',
      text: '支付处理中',
    };
  }

  if (!latestPaymentState.value) {
    return {
      color: 'default',
      text: '待支付',
    };
  }

  if (latestPaymentState.value.success) {
    return {
      color: 'success',
      text: '支付成功',
    };
  }

  if (latestPaymentState.value.tradeState === 'CANCEL') {
    return {
      color: 'warning',
      text: '已取消',
    };
  }

  return {
    color: 'error',
    text: latestPaymentStatusLabel.value,
  };
});

function readBooleanField(
  record: Record<string, unknown>,
  keys: string[],
): null | { field: string; value: boolean } {
  for (const key of keys) {
    if (typeof record[key] === 'boolean') {
      return {
        field: key,
        value: record[key] as boolean,
      };
    }
  }

  return null;
}

function readStringField(
  record: Record<string, unknown>,
  keys: string[],
): null | { field: string; value: string } {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return {
        field: key,
        value: value.trim(),
      };
    }
  }

  return null;
}

function formatMembershipExpireAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('zh-CN');
}

function addMonths(source: Date, months: number) {
  const date = new Date(source);
  date.setMonth(date.getMonth() + months);
  return date;
}

function resolveOrganizationProvisioningTagColor(status: string) {
  if (status === 'failed_manual') {
    return 'error';
  }

  if (status === 'failed_retryable') {
    return 'warning';
  }

  return 'processing';
}

function resolveCheckoutResultFromOrganizationProvisioningStatus(
  status: null | OrganizationProvisioningStatus,
): MembershipCheckoutResult {
  const provisioningStatus = status?.organizationProvisioningStatus;
  if (!provisioningStatus) {
    return 'ready';
  }

  if (ORGANIZATION_PROVISIONING_FAILED_STATES.has(provisioningStatus)) {
    return 'failed';
  }

  if (ORGANIZATION_PROVISIONING_PENDING_STATES.has(provisioningStatus)) {
    return 'syncing';
  }

  return 'ready';
}

function resolveMembershipActiveByStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (
    ['active', 'enabled', 'member', 'paid', 'success', 'vip'].includes(
      normalized,
    )
  ) {
    return true;
  }

  if (
    ['cancel', 'disabled', 'expired', 'inactive', 'none', 'pending'].includes(
      normalized,
    )
  ) {
    return false;
  }

  return null;
}

function resolveProfileMembershipState(
  value: null | Record<string, unknown> | undefined,
): null | ProfileMembershipState {
  if (!value) {
    return null;
  }

  const expireAtField = readStringField(value, [
    'memberExpireAt',
    'memberExpiresAt',
    'membershipExpireAt',
    'membershipExpiresAt',
    'vipExpireAt',
    'vipExpiresAt',
  ]);
  const statusField = readStringField(value, [
    'memberStatus',
    'membershipStatus',
    'vipStatus',
  ]);
  const booleanField = readBooleanField(value, [
    'isMember',
    'isMembership',
    'isVip',
  ]);

  if (statusField) {
    const active = resolveMembershipActiveByStatus(statusField.value);
    if (active !== null) {
      let label = statusField.value;
      if (active && expireAtField?.value) {
        label = `组织会员有效至 ${formatMembershipExpireAt(expireAtField.value)}`;
      } else if (active) {
        label = '组织会员已开通';
      }

      return {
        active,
        expireAt: expireAtField?.value,
        label,
        sourceField: statusField.field,
      };
    }
  }

  if (booleanField) {
    let label = '未开通组织会员';
    if (booleanField.value && expireAtField?.value) {
      label = `组织会员有效至 ${formatMembershipExpireAt(expireAtField.value)}`;
    } else if (booleanField.value) {
      label = '组织会员已开通';
    }

    return {
      active: booleanField.value,
      expireAt: expireAtField?.value,
      label,
      sourceField: booleanField.field,
    };
  }

  if (expireAtField) {
    const expireAt = new Date(expireAtField.value);
    if (!Number.isNaN(expireAt.getTime())) {
      const active = expireAt.getTime() > Date.now();
      return {
        active,
        expireAt: expireAtField.value,
        label: active
          ? `组织会员有效至 ${formatMembershipExpireAt(expireAtField.value)}`
          : '组织会员已过期',
        sourceField: expireAtField.field,
      };
    }
  }

  return null;
}

function resolveProfileOrganizationProvisioningState(
  value: null | object | undefined,
): null | ProfileOrganizationProvisioningState {
  if (!value) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const status = readStringField(record, [
    'organizationProvisioningStatus',
  ])?.value;
  if (!status || ['active', 'none'].includes(status)) {
    return null;
  }

  const message = readStringField(record, [
    'organizationProvisioningMessage',
  ])?.value;
  const targetCustomerId = readStringField(record, ['targetCustomerId'])?.value;

  return {
    label: message || '组织空间开通中',
    status,
    targetCustomerId,
  };
}

function resolveSourceOrganizationState(
  value: null | object | undefined,
): null | SourceOrganizationState {
  if (!value) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const sourceOrganization = record.sourceOrganization;
  if (!sourceOrganization || typeof sourceOrganization !== 'object') {
    return null;
  }

  const organizationRecord = sourceOrganization as Record<string, unknown>;
  const id = Number(organizationRecord.id);
  const name = readStringField(organizationRecord, ['name'])?.value;
  const sourceCustomerId = readStringField(organizationRecord, [
    'sourceCustomerId',
  ])?.value;
  const memberRole = readStringField(organizationRecord, ['memberRole'])?.value;
  if (!Number.isInteger(id) || id <= 0 || !name || !sourceCustomerId) {
    return null;
  }

  return {
    city: readStringField(organizationRecord, ['city'])?.value,
    companyShortName: readStringField(organizationRecord, ['companyShortName'])
      ?.value,
    id,
    memberRole: memberRole || 'member',
    name,
    sourceCustomerId,
  };
}

function handleGoBack() {
  if (
    !membershipAccessState.value.accessRestricted &&
    window.history.length > 1
  ) {
    router.back();
    return;
  }

  void router.push(
    membershipAccessState.value.accessRestricted ? '/system/park' : '/profile',
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeMembershipPaymentState(
  orderStatus: WechatPayOrderStatus,
): MembershipPaymentState {
  return {
    outTradeNo: orderStatus.outTradeNo,
    success: orderStatus.success,
    tradeState: orderStatus.tradeState,
    tradeStateDesc: orderStatus.tradeStateDesc || orderStatus.tradeState,
    transactionId: orderStatus.transactionId,
  };
}

function normalizeStalePaymentState(
  orderStatus: WechatPayOrderStatus,
): MembershipPaymentState {
  return {
    outTradeNo: orderStatus.outTradeNo,
    success: false,
    tradeState: 'STALE_PAYMENT',
    tradeStateDesc: '该支付订单已不是当前开通订单，请联系客服处理退款或对账',
    transactionId: orderStatus.transactionId,
  };
}

function resolveVipMembershipApplyFailureMessage(
  orderStatus: WechatPayOrderStatus,
) {
  const result = orderStatus.vipMembershipResult;
  if (!orderStatus.success || result?.applied || result?.alreadyApplied) {
    return '';
  }

  if (!result) {
    return '支付已完成，但组织会员开通状态未确认，请稍后刷新或联系客服处理。';
  }

  if (result.reason === 'amount-mismatch') {
    return '支付金额异常，组织会员未开通，请联系客服处理退款或对账。';
  }

  if (
    [
      'missing-center-user',
      'missing-out-trade-no',
      'missing-user-context',
      'not-vip-membership',
    ].includes(result.reason || '')
  ) {
    return '支付订单归属信息异常，组织会员未开通，请联系客服处理。';
  }

  return '支付已完成，但组织会员开通未生效，请联系客服处理。';
}

function normalizeVipMembershipApplyFailureState(
  orderStatus: WechatPayOrderStatus,
): MembershipPaymentState | null {
  const failureMessage = resolveVipMembershipApplyFailureMessage(orderStatus);
  if (!failureMessage) {
    return null;
  }

  const reason = orderStatus.vipMembershipResult?.reason;
  return {
    outTradeNo: orderStatus.outTradeNo,
    success: false,
    tradeState: reason
      ? `VIP_${reason.toUpperCase().replaceAll('-', '_')}`
      : 'VIP_APPLY_UNCONFIRMED',
    tradeStateDesc: failureMessage,
    transactionId: orderStatus.transactionId,
  };
}

async function pollWechatOrderStatus(
  queryOrderStatus: () => Promise<WechatPayOrderStatus>,
) {
  let lastStatus: null | WechatPayOrderStatus = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentStatus = await queryOrderStatus();
    lastStatus = currentStatus;

    if (
      currentStatus.success ||
      !ORDER_PENDING_STATES.has(currentStatus.tradeState)
    ) {
      return currentStatus;
    }

    await sleep((attempt + 1) * 1500);
  }

  return lastStatus;
}

function handleContactSupport() {
  const outTradeNo = latestPaymentState.value?.outTradeNo;
  if (outTradeNo) {
    message.info(`如支付结果未同步，请联系客服并提供订单号：${outTradeNo}`);
    return;
  }

  message.info('如支付遇到问题，请联系客服处理；组织会员开通以订单状态为准。');
}

function scrollToPageElement(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  const behavior: ScrollBehavior = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
    ? 'auto'
    : 'smooth';

  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior, block: 'start' });
}

function handleOrganizationSetupNavigate() {
  scrollToPageElement(organizationSetupRef.value || paymentSectionRef.value);
}

function handleMobileCheckoutNavigate() {
  scrollToPageElement(paymentSectionRef.value);
}

function applyOrganizationIdentityDraft(value: null | object | undefined) {
  if (!value || organizationIdentityTouched.value) {
    return;
  }

  const record = value as Record<string, unknown>;
  const sourceOrganization = resolveSourceOrganizationState(value);
  const draftCity =
    readStringField(record, ['targetCity'])?.value || sourceOrganization?.city;
  const draftCompanyShortName =
    readStringField(record, ['targetCompanyShortName'])?.value ||
    sourceOrganization?.companyShortName;

  if (draftCity && !organizationCity.value.trim()) {
    organizationCity.value = draftCity;
  }

  if (draftCompanyShortName && !organizationCompanyShortName.value.trim()) {
    organizationCompanyShortName.value = draftCompanyShortName;
  }
}

function resolveOrganizationIdentityPayload() {
  if (!requiresOrganizationIdentity.value) {
    return undefined;
  }

  return {
    city: organizationCity.value.trim(),
    companyShortName: organizationCompanyShortName.value.trim(),
  };
}

function validateOrganizationIdentity() {
  organizationIdentityTouched.value = true;
  if (!organizationIdentityError.value) {
    return true;
  }

  handleOrganizationSetupNavigate();
  return false;
}

async function handleCreateSourceOrganization() {
  if (organizationCreateLoading.value || !canSetupSourceOrganization.value) {
    return;
  }

  if (!validateOrganizationIdentity()) {
    return;
  }

  organizationCreateLoading.value = true;
  const creatingNewOrganization = canCreateSourceOrganization.value;
  try {
    const result = await createSourceOrganizationApi({
      organizationIdentity: {
        city: organizationCity.value.trim(),
        companyShortName: organizationCompanyShortName.value.trim(),
      },
    });

    latestOrganizationProvisioningStatus.value = {
      currentCustomerId: currentCustomerId.value,
      isOrganizationProvisioning: false,
      organizationProvisioningStatus: 'none',
      sourceCustomerId: currentCustomerId.value,
      sourceOrganization: result.sourceOrganization,
      sourceOrganizationCount: result.sourceOrganizationCount,
    };

    await Promise.all([
      authStore.fetchUserInfo().catch((error) => {
        console.warn('创建组织后刷新用户信息失败:', error);
      }),
      refreshOrganizationProvisioningStatus().catch((error) => {
        console.warn('创建组织后刷新组织状态失败:', error);
      }),
    ]);

    message.success(
      creatingNewOrganization
        ? `${result.sourceOrganization.name || '组织空间'}已创建`
        : '组织信息已保存',
    );
  } catch (error) {
    console.error('创建组织空间失败:', error);
  } finally {
    organizationCreateLoading.value = false;
  }
}

async function handleJoinExistingOrganization() {
  if (organizationJoinLoading.value) {
    return;
  }

  organizationInvitationTouched.value = true;
  if (organizationInvitationError.value) {
    return;
  }

  organizationJoinLoading.value = true;
  try {
    const result = await joinOrganizationByInvitationCodeApi(
      organizationInvitationCode.value.trim(),
    );
    if (result.requiresRelogin) {
      message.success(
        `已加入 ${
          result.organizationSpaceName || result.customerName || '目标组织'
        }，请重新登录进入组织空间。`,
      );
      await authStore.logout(false, false);
      return;
    }

    message.success('当前账号已在该组织空间。');
    await authStore.fetchUserInfo();
  } finally {
    organizationJoinLoading.value = false;
  }
}

async function refreshWechatPayAppConfig(options: { silent?: boolean } = {}) {
  if (wechatPayConfigReady.value) {
    return wechatPayConfigured.value ? wechatOpenAppId.value : '';
  }

  wechatConfigLoading.value = true;
  try {
    const config = await loadWechatPayAppConfig();
    wechatOpenAppId.value = config.appId;
    wechatPayMerchantId.value = config.mchId;
    wechatPayConfigured.value = config.configured === true;
    wechatPayMissingConfig.value = Array.isArray(config.missing)
      ? config.missing
      : [];
    wechatPayConfigError.value = wechatPayConfigured.value
      ? ''
      : `缺少微信支付配置：${wechatPayMissingConfig.value.join('、')}`;
    return wechatPayConfigured.value ? wechatOpenAppId.value : '';
  } catch (error) {
    console.error('获取微信支付配置失败:', error);
    wechatOpenAppId.value = '';
    wechatPayMerchantId.value = '';
    wechatPayConfigured.value = false;
    wechatPayMissingConfig.value = [];
    wechatPayConfigError.value =
      error instanceof Error ? error.message : '获取微信支付配置失败';
    if (!options.silent) {
      message.error(wechatPayConfigError.value);
    }
    return '';
  } finally {
    wechatConfigLoading.value = false;
  }
}

async function requestWechatPay(options: { scrollToPayment?: boolean } = {}) {
  if (payLoading.value) {
    return;
  }

  if (options.scrollToPayment) {
    handleMobileCheckoutNavigate();
  }

  if (organizationProvisioningPaymentBlocked.value) {
    return;
  }

  if (!sourceOrganizationPaymentAllowed.value) {
    message.warning('只有组织所有者可以为该组织开通或续费会员');
    return;
  }

  if (!validateOrganizationIdentity()) {
    return;
  }

  const currentWechatOpenAppId = await refreshWechatPayAppConfig();
  if (!currentWechatOpenAppId) {
    message.error('未获取到微信开放平台移动应用 AppID');
    return;
  }

  if (!agreedToTerms.value) {
    agreementModalOpen.value = true;
    return;
  }

  await handleWechatPay();
}

async function handleAgreementModalConfirm() {
  if (payLoading.value) {
    return;
  }

  if (organizationProvisioningPaymentBlocked.value) {
    agreementModalOpen.value = false;
    return;
  }

  if (!sourceOrganizationPaymentAllowed.value) {
    agreementModalOpen.value = false;
    message.warning('只有组织所有者可以为该组织开通或续费会员');
    return;
  }

  const currentWechatOpenAppId = await refreshWechatPayAppConfig();
  if (!currentWechatOpenAppId) {
    message.error('未获取到微信开放平台移动应用 AppID');
    return;
  }

  if (!validateOrganizationIdentity()) {
    return;
  }

  agreedToTerms.value = true;
  agreementModalOpen.value = false;
  await handleWechatPay();
}

async function handleCheckoutResultLogout() {
  checkoutResultModalOpen.value = false;
  await authStore.logout(false);
}

function handleOpenRefundOrders() {
  void router.push('/profile/vip-refunds');
}

async function refreshOrganizationProvisioningStatus(
  checkoutFlowToken?: string,
) {
  const state = await getOrganizationProvisioningStatus({
    checkoutFlowToken,
  });
  latestOrganizationProvisioningStatus.value = state;
  return state;
}

async function pollOrganizationProvisioningStatusAfterPaid(
  checkoutFlowToken?: string,
) {
  let lastStatus: null | OrganizationProvisioningStatus = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const currentStatus =
      await refreshOrganizationProvisioningStatus(checkoutFlowToken);
    lastStatus = currentStatus;

    if (
      !ORGANIZATION_PROVISIONING_PENDING_STATES.has(
        currentStatus.organizationProvisioningStatus,
      )
    ) {
      return currentStatus;
    }

    await sleep((attempt + 1) * 1800);
  }

  return lastStatus;
}

async function showCheckoutResultAfterPaid(checkoutFlowToken?: string) {
  membershipCheckoutResult.value = 'ready';
  message.loading({
    content: '支付成功，正在完成组织空间开通...',
    duration: 0,
    key: PAY_MESSAGE_KEY,
  });

  try {
    const provisioningStatus =
      await pollOrganizationProvisioningStatusAfterPaid(checkoutFlowToken);
    membershipCheckoutResult.value =
      resolveCheckoutResultFromOrganizationProvisioningStatus(
        provisioningStatus,
      );
  } catch (error) {
    console.warn('支付成功后刷新组织空间状态失败:', error);
    membershipCheckoutResult.value = 'ready';
  }

  message.destroy(PAY_MESSAGE_KEY);
  checkoutResultModalOpen.value = true;
}

async function handleWechatPay() {
  if (payLoading.value) {
    return;
  }

  if (!agreedToTerms.value) {
    agreementModalOpen.value = true;
    return;
  }

  if (organizationProvisioningPaymentBlocked.value) {
    return;
  }

  if (!sourceOrganizationPaymentAllowed.value) {
    message.warning('只有组织所有者可以为该组织开通或续费会员');
    return;
  }

  if (!validateOrganizationIdentity()) {
    return;
  }

  const currentWechatOpenAppId = await refreshWechatPayAppConfig();
  if (!currentWechatOpenAppId) {
    message.error('未配置微信开放平台移动应用 AppID');
    return;
  }

  if (!appPaySupported.value) {
    message.warning('当前仅支持 Android App 内微信支付');
    return;
  }

  if (!isWechatInstalled(currentWechatOpenAppId)) {
    message.warning('未检测到微信客户端，请先安装微信');
    return;
  }

  payLoading.value = true;
  let currentOutTradeNo = '';
  membershipCheckoutResult.value = 'unknown';

  message.loading({
    content: '正在创建微信支付订单...',
    duration: 0,
    key: PAY_MESSAGE_KEY,
  });

  try {
    const execution = await payWithWechatApp({
      amount: MEMBERSHIP_AMOUNT_FEN,
      attach: 'vip-membership',
      description: `${membershipScopeName.value} 组织会员月度服务`,
      deviceId: 'vip-membership-page',
      organizationIdentity: resolveOrganizationIdentityPayload(),
    });

    currentOutTradeNo = execution.launchParams.outTradeNo;

    if (execution.payResult.reason === 'cancel') {
      latestPaymentState.value = {
        outTradeNo: currentOutTradeNo,
        success: false,
        tradeState: 'CANCEL',
        tradeStateDesc: execution.payResult.message || '已取消微信支付',
      };
      message.info({
        content: execution.payResult.message || '已取消微信支付',
        key: PAY_MESSAGE_KEY,
      });
      return;
    }

    const shouldQueryOrder =
      execution.payResult.ok || execution.payResult.reason === 'timeout';

    if (!shouldQueryOrder) {
      latestPaymentState.value = {
        outTradeNo: currentOutTradeNo,
        success: false,
        tradeState: execution.payResult.reason || 'PAY_FAILED',
        tradeStateDesc: execution.payResult.message || '拉起微信支付失败',
      };
      message.error({
        content: execution.payResult.message || '拉起微信支付失败',
        key: PAY_MESSAGE_KEY,
      });
      return;
    }

    message.loading({
      content:
        execution.payResult.reason === 'timeout'
          ? '正在确认支付结果，请稍候...'
          : '已拉起微信，请在微信中完成支付...',
      duration: 0,
      key: PAY_MESSAGE_KEY,
    });

    const orderStatus = await pollWechatOrderStatus(execution.queryOrderStatus);
    if (!orderStatus) {
      throw new Error('未获取到支付订单状态');
    }

    latestPaymentState.value = normalizeMembershipPaymentState(orderStatus);

    if (orderStatus.vipMembershipResult?.reason === 'stale-payment') {
      latestPaymentState.value = normalizeStalePaymentState(orderStatus);
      await refreshOrganizationProvisioningStatus(
        execution.checkoutFlowToken,
      ).catch((error) => {
        console.warn('旧支付订单同步后刷新组织空间状态失败:', error);
      });
      message.warning({
        content: '该支付订单已不是当前开通订单，请联系客服处理退款或对账。',
        duration: 6,
        key: PAY_MESSAGE_KEY,
      });
      return;
    }

    const membershipApplyFailureState =
      normalizeVipMembershipApplyFailureState(orderStatus);
    if (membershipApplyFailureState) {
      latestPaymentState.value = membershipApplyFailureState;
      message.error({
        content: membershipApplyFailureState.tradeStateDesc,
        duration: 6,
        key: PAY_MESSAGE_KEY,
      });
      return;
    }

    if (orderStatus.success) {
      await showCheckoutResultAfterPaid(execution.checkoutFlowToken);
      return;
    }

    const statusText = orderStatus.tradeStateDesc || orderStatus.tradeState;
    message.warning({
      content: `支付未完成，当前订单状态：${statusText}`,
      duration: 4,
      key: PAY_MESSAGE_KEY,
    });
  } catch (error) {
    console.error('发起会员微信支付失败:', error);
    latestPaymentState.value = {
      outTradeNo: currentOutTradeNo,
      success: false,
      tradeState: 'PENDING_CONFIRM',
      tradeStateDesc: currentOutTradeNo
        ? '支付结果待确认，请稍后根据订单号查单'
        : '创建微信支付订单失败',
    };
    message.error({
      content: error instanceof Error ? error.message : '发起会员微信支付失败',
      duration: 4,
      key: PAY_MESSAGE_KEY,
    });
  } finally {
    payLoading.value = false;
  }
}

onMounted(() => {
  void refreshWechatPayAppConfig({ silent: true });
  void refreshOrganizationProvisioningStatus().catch((error) => {
    console.warn('读取组织空间信息草稿失败:', error);
  });
  if (route.query.section === 'org') {
    window.setTimeout(handleOrganizationSetupNavigate, 80);
  }
});
</script>

<template>
  <div class="vip-pay-page">
    <div class="vip-pay-page__shell">
      <button class="vip-pay-page__back" type="button" @click="handleGoBack">
        <VbenIcon icon="mdi:arrow-left" class="size-4" />
        <span>{{ backButtonLabel }}</span>
      </button>

      <section v-if="membershipGateNotice" class="pay-alert">
        <div>
          <p class="pay-head__eyebrow">{{ membershipGateNotice.eyebrow }}</p>
          <h2>{{ membershipGateNotice.title }}</h2>
          <p class="pay-alert__description">
            {{ membershipGateNotice.description }}
          </p>
        </div>
        <div class="pay-alert__scope">
          <span>当前仍可访问</span>
          <strong>{{ RESTRICTED_PAGE_LABEL }}</strong>
        </div>
      </section>

      <section
        v-if="requiresOrganizationIdentity || canJoinExistingOrganization"
        ref="organizationSetupRef"
        class="organization-setup-card"
        tabindex="-1"
      >
        <div class="organization-setup-card__head">
          <div>
            <p class="pay-card__eyebrow">Organization</p>
            <h2>组织空间</h2>
            <p>
              新账号可以先创建自己的组织空间，或通过管理员的邀请码加入已有组织。
            </p>
          </div>
          <Tag v-if="sourceOrganizationState" color="processing">
            {{
              sourceOrganizationState.memberRole === 'owner' ? '所有者' : '成员'
            }}
          </Tag>
        </div>

        <div class="organization-setup-card__grid">
          <article
            v-if="requiresOrganizationIdentity"
            class="organization-identity-card"
          >
            <div>
              <h3>
                {{
                  canCreateSourceOrganization ? '创建组织空间' : '补全组织信息'
                }}
              </h3>
              <p>
                {{
                  canCreateSourceOrganization
                    ? '创建后可继续开通会员，组织成员后续通过邀请码加入。'
                    : '补全后可由组织所有者开通或续费组织会员。'
                }}
              </p>
            </div>
            <div class="organization-identity-card__fields">
              <label class="organization-identity-field">
                <span>所在城市</span>
                <Input
                  v-model:value="organizationCity"
                  placeholder="如 深圳市"
                  @blur="organizationIdentityTouched = true"
                />
              </label>
              <label class="organization-identity-field">
                <span>公司简称</span>
                <Input
                  v-model:value="organizationCompanyShortName"
                  placeholder="如 腾讯"
                  @blur="organizationIdentityTouched = true"
                  @press-enter="handleCreateSourceOrganization"
                />
              </label>
            </div>
            <p
              v-if="organizationIdentityTouched && organizationIdentityError"
              class="organization-identity-card__error"
            >
              {{ organizationIdentityError }}
            </p>
            <Button
              v-if="canSetupSourceOrganization"
              block
              type="primary"
              :loading="organizationCreateLoading"
              @click="handleCreateSourceOrganization"
            >
              {{
                canCreateSourceOrganization
                  ? '免费创建组织空间'
                  : '保存组织信息'
              }}
            </Button>
          </article>

          <article
            v-if="canJoinExistingOrganization"
            class="organization-invitation-card"
          >
            <div>
              <h3>加入已有组织</h3>
              <p>
                填写管理员提供的邀请码。加入成功后需要重新登录进入组织空间。
              </p>
            </div>
            <label class="organization-identity-field">
              <span>组织邀请码</span>
              <Input
                v-model:value="organizationInvitationCode"
                placeholder="输入组织邀请码"
                @blur="organizationInvitationTouched = true"
                @press-enter="handleJoinExistingOrganization"
              />
            </label>
            <p
              v-if="
                organizationInvitationTouched && organizationInvitationError
              "
              class="organization-identity-card__error"
            >
              {{ organizationInvitationError }}
            </p>
            <Button
              block
              :loading="organizationJoinLoading"
              @click="handleJoinExistingOrganization"
            >
              加入已有组织
            </Button>
          </article>
        </div>
      </section>

      <section class="pay-head">
        <div class="pay-head__intro">
          <p class="pay-head__eyebrow">Membership Checkout</p>
          <h1>开通组织会员服务</h1>
          <p class="pay-head__description">
            为
            {{ membershipScopeName }}
            开通组织月度会员后，组织成员可使用定位服务、招商雷达等会员专属能力。
          </p>
        </div>

        <div class="pay-head__price-card">
          <div class="pay-head__tags">
            <Tag color="processing">Android App</Tag>
            <Tag color="gold">月度方案</Tag>
          </div>
          <div class="pay-head__amount">
            <span class="pay-head__currency">¥</span>
            <strong>{{ membershipPlan.price }}</strong>
            <span class="pay-head__period">/{{ membershipPlan.period }}</span>
          </div>
          <p class="pay-head__caption">
            原价 ¥{{ membershipPlan.originalPrice }}，当前方案立省 ¥{{
              membershipPlan.savings
            }}。
          </p>
        </div>
      </section>

      <div class="pay-layout">
        <main class="pay-main">
          <section class="pay-card">
            <div class="pay-card__head">
              <div>
                <p class="pay-card__eyebrow">Benefits</p>
                <h2>组织会员权益</h2>
              </div>
              <span class="pay-card__hint">支付前可查看</span>
            </div>

            <div class="benefit-grid">
              <article
                v-for="item in benefitItems"
                :key="item.title"
                class="benefit-card"
              >
                <VbenIcon :icon="item.icon" class="benefit-card__icon" />
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </article>
            </div>
          </section>
        </main>

        <aside class="pay-side">
          <section
            id="vip-payment-section"
            ref="paymentSectionRef"
            class="order-card"
            tabindex="-1"
          >
            <div class="order-card__head">
              <div>
                <p class="pay-card__eyebrow">Order</p>
                <h2>订单摘要</h2>
              </div>
              <Tag :color="orderStatusTag.color">{{ orderStatusTag.text }}</Tag>
            </div>

            <div class="order-card__account">
              <span>开通组织</span>
              <strong>{{ membershipScopeName }}</strong>
            </div>

            <div
              class="order-card__runtime"
              :class="`order-card__runtime--${wechatPayRuntimeState.tone}`"
            >
              <VbenIcon :icon="wechatPayRuntimeState.icon" />
              <div>
                <strong>{{ wechatPayRuntimeState.title }}</strong>
                <p>{{ wechatPayRuntimeState.description }}</p>
              </div>
            </div>

            <div class="order-card__rows">
              <div class="order-card__row">
                <span>套餐</span>
                <span>{{ membershipPlan.name }}</span>
              </div>
              <div class="order-card__row">
                <span>计费周期</span>
                <span>1 {{ membershipPlan.period }}</span>
              </div>
              <div class="order-card__row">
                <span>支付方式</span>
                <span>微信 App 支付</span>
              </div>
              <div class="order-card__row order-card__row--wrap">
                <span>支付后有效期</span>
                <span>{{ postPaymentMembershipExpireLabel }}</span>
              </div>
              <div
                v-if="profileOrganizationProvisioningState"
                class="order-card__row order-card__row--wrap"
              >
                <span>组织空间</span>
                <span>
                  {{ profileOrganizationProvisioningState.label }}
                </span>
              </div>
              <div
                v-if="latestPaymentState?.outTradeNo"
                class="order-card__row"
              >
                <span>最近订单号</span>
                <span>{{ latestPaymentState.outTradeNo }}</span>
              </div>
            </div>

            <div class="order-card__divider"></div>

            <div class="order-card__total">
              <span>应付金额</span>
              <strong>¥{{ membershipPlan.price }}</strong>
            </div>

            <div v-if="latestPaymentState" class="order-card__payment-result">
              <div class="order-card__row">
                <span>支付状态</span>
                <span>{{ latestPaymentStatusLabel }}</span>
              </div>
              <div
                v-if="latestPaymentState.transactionId"
                class="order-card__row order-card__row--wrap"
              >
                <span>微信流水号</span>
                <span>{{ latestPaymentState.transactionId }}</span>
              </div>
            </div>

            <div class="order-card__agreement">
              <Checkbox v-model:checked="agreedToTerms">
                我已阅读并同意相关协议
              </Checkbox>
              <div class="order-card__agreement-links">
                <button type="button" @click="openServiceAgreementDialog">
                  《会员服务协议》
                </button>
                <button type="button" @click="openPrivacyPolicyDialog">
                  《隐私政策》
                </button>
              </div>
              <p class="order-card__agreement-hint">
                {{ paymentAgreementHint }}
              </p>
            </div>

            <div class="order-card__actions">
              <Button
                block
                size="large"
                type="primary"
                :disabled="payButtonDisabled"
                :loading="payLoading"
                @click="requestWechatPay()"
              >
                {{ payButtonText }}
              </Button>
              <Button block size="large" @click="handleContactSupport">
                支付遇到问题
              </Button>
            </div>
          </section>
        </aside>
        <div v-if="isSuperUser" class="order-card__management">
          <div>
            <strong>订单管理</strong>
            <p>可查看当前组织的所有组织订单并按规则退款。</p>
          </div>
          <Button @click="handleOpenRefundOrders"> 管理组织订单 </Button>
        </div>
      </div>
    </div>

    <div class="mobile-checkout-bar">
      <div>
        <span class="mobile-checkout-bar__label">应付金额</span>
        <strong class="mobile-checkout-bar__price">
          ¥{{ membershipPlan.price }}/{{ membershipPlan.period }}
        </strong>
      </div>
      <Button
        type="primary"
        :disabled="payButtonDisabled"
        :loading="payLoading"
        @click="requestWechatPay({ scrollToPayment: true })"
      >
        {{ payLoading ? '处理中...' : '微信支付' }}
      </Button>
    </div>

    <Modal
      v-model:open="agreementModalOpen"
      centered
      cancel-text="取消"
      ok-text="同意并微信支付"
      title="确认会员服务协议"
      :confirm-loading="payLoading"
      :mask-closable="!payLoading"
      :ok-button-props="{ disabled: payButtonDisabled }"
      @ok="handleAgreementModalConfirm"
    >
      <div class="agreement-confirm">
        <p>
          开通组织会员前，请先阅读并同意《会员服务协议》和《隐私政策》。确认后将直接发起微信支付。
        </p>
        <div class="agreement-confirm__links">
          <button type="button" @click="openServiceAgreementDialog">
            查看《会员服务协议》
          </button>
          <button type="button" @click="openPrivacyPolicyDialog">
            查看《隐私政策》
          </button>
        </div>
      </div>
    </Modal>

    <Modal
      v-model:open="checkoutResultModalOpen"
      centered
      cancel-text="稍后处理"
      :mask-closable="false"
      :ok-text="checkoutResultModalView.okText"
      :title="checkoutResultModalView.title"
      @ok="handleCheckoutResultLogout"
    >
      <div
        class="membership-success"
        :class="`membership-success--${checkoutResultModalView.tone}`"
      >
        <VbenIcon
          :icon="checkoutResultModalView.icon"
          class="membership-success__icon"
        />
        <div>
          <h3>{{ checkoutResultModalView.heading }}</h3>
          <p>{{ checkoutResultModalView.description }}</p>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.vip-pay-page {
  --vip-page-bg: linear-gradient(180deg, #f6f8fb 0%, #eef3f7 100%);
  --vip-border: rgb(15 23 42 / 10%);
  --vip-card: #fff;
  --vip-card-muted: #f8fafc;
  --vip-text: #1f2937;
  --vip-text-soft: #667085;
  --vip-accent: #1764ff;
  --vip-accent-soft: rgb(23 100 255 / 8%);
  --vip-success: #11845b;
  --vip-warning: #b76e00;
  --vip-shadow: 0 12px 30px rgb(15 23 42 / 7%);

  min-height: 100%;
  padding: 24px 24px 104px;
  background: var(--vip-page-bg);
}

.vip-pay-page__shell {
  width: min(1240px, 100%);
  margin: 0 auto;
}

.vip-pay-page__back {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: var(--vip-text);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.pay-alert {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: center;
  padding: 20px 22px;
  margin-top: 18px;
  background: #fffbeb;
  border: 1px solid rgb(183 121 31 / 20%);
  border-radius: 16px;
  box-shadow: 0 8px 20px rgb(15 23 42 / 5%);
}

.pay-alert h2 {
  margin: 0;
  color: var(--vip-text);
}

.pay-alert__description {
  margin: 12px 0 0;
  line-height: 1.8;
  color: var(--vip-text-soft);
}

.pay-alert__scope {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
  padding: 14px 16px;
  background: rgb(255 255 255 / 72%);
  border-radius: 12px;
}

.pay-alert__scope span {
  font-size: 13px;
  color: var(--vip-text-soft);
}

.pay-alert__scope strong {
  font-size: 16px;
  color: var(--vip-text);
}

.pay-head {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 380px);
  gap: 24px;
  padding: 28px;
  margin-top: 18px;
  background: #fff;
  border: 1px solid var(--vip-border);
  border-radius: 18px;
  box-shadow: var(--vip-shadow);
}

.pay-head__eyebrow,
.pay-card__eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--vip-accent);
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.pay-head h1,
.pay-card h2 {
  margin: 0;
  color: var(--vip-text);
}

.pay-head h1 {
  font-size: 38px;
  line-height: 1.12;
}

.pay-head__description {
  max-width: 720px;
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 1.9;
  color: var(--vip-text-soft);
}

.pay-head__price-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  justify-content: space-between;
  padding: 22px;
  background: var(--vip-card-muted);
  border: 1px solid var(--vip-border);
  border-radius: 14px;
}

.pay-head__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pay-head__amount {
  display: flex;
  align-items: flex-end;
  color: var(--vip-text);
}

.pay-head__currency {
  padding-bottom: 10px;
  font-size: 24px;
  font-weight: 700;
}

.pay-head__amount strong {
  font-size: 52px;
  line-height: 1;
}

.pay-head__period {
  padding-bottom: 9px;
  font-size: 16px;
  color: var(--vip-text-soft);
}

.pay-head__caption {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--vip-text-soft);
}

.pay-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 20px;
  align-items: start;
  margin-top: 20px;
}

.pay-main,
.pay-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pay-side {
  position: sticky;
  top: 20px;
}

.pay-card,
.order-card {
  padding: 24px;
  background: var(--vip-card);
  border: 1px solid var(--vip-border);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgb(15 23 42 / 5%);
}

.order-card {
  scroll-margin-top: 18px;
}

.order-card:focus {
  outline: 2px solid rgb(23 100 255 / 38%);
  outline-offset: 4px;
}

.pay-card__head,
.order-card__head {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.pay-card__hint {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--vip-text-soft);
  background: var(--vip-card-muted);
  border-radius: 999px;
}

.pay-card h2 {
  font-size: 28px;
  line-height: 1.2;
}

.benefit-card h3 {
  margin: 0;
  color: var(--vip-text);
}

.benefit-card p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--vip-text-soft);
}

.benefit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.benefit-card {
  padding: 18px;
  background: var(--vip-card-muted);
  border: 1px solid var(--vip-border);
  border-radius: 14px;
}

.benefit-card__icon {
  margin-bottom: 12px;
  font-size: 26px;
  color: var(--vip-accent);
}

.order-card__account {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  margin-top: 20px;
  background: var(--vip-accent-soft);
  border-radius: 14px;
}

.order-card__runtime {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  margin-top: 14px;
  background: var(--vip-card-muted);
  border: 1px solid var(--vip-border);
  border-radius: 14px;
}

.order-card__runtime > :first-child {
  flex: 0 0 auto;
  margin-top: 2px;
  font-size: 22px;
  color: var(--vip-text-soft);
}

.order-card__runtime strong {
  color: var(--vip-text);
}

.order-card__runtime p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--vip-text-soft);
}

.order-card__runtime--success {
  background: rgb(17 132 91 / 7%);
  border-color: rgb(17 132 91 / 18%);
}

.order-card__runtime--success > :first-child {
  color: var(--vip-success);
}

.order-card__runtime--warning {
  background: rgb(183 110 0 / 8%);
  border-color: rgb(183 110 0 / 18%);
}

.order-card__runtime--warning > :first-child {
  color: var(--vip-warning);
}

.order-card__runtime--processing > :first-child {
  color: var(--vip-accent);
}

.order-card__account span,
.order-card__row span:first-child,
.mobile-checkout-bar__label,
.order-card__agreement-hint {
  font-size: 13px;
  color: var(--vip-text-soft);
}

.order-card__account strong,
.order-card__total strong {
  color: var(--vip-text);
}

.order-card__rows,
.order-card__payment-result,
.order-card__management {
  display: grid;
  gap: 12px;
  margin-top: 20px;
}

.order-card__row,
.order-card__total {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.order-card__row span:last-child,
.order-card__total strong,
.mobile-checkout-bar__price {
  font-weight: 700;
}

.order-card__row--wrap {
  align-items: flex-start;
}

.order-card__row--wrap span:last-child {
  text-align: right;
  word-break: break-all;
}

.order-card__management {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--vip-accent-soft);
  border: 1px solid rgb(23 100 255 / 12%);
  border-radius: 14px;
}

.order-card__management > div {
  flex: 1;
  min-width: 0;
}

.order-card__management strong {
  color: var(--vip-accent);
}

.order-card__management p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--vip-text-soft);
}

.order-card__divider {
  height: 1px;
  margin: 18px 0;
  background: rgb(15 23 42 / 8%);
}

.order-card__total span {
  font-size: 15px;
  color: var(--vip-text);
}

.order-card__total strong {
  font-size: 32px;
  line-height: 1;
}

.organization-setup-card {
  display: grid;
  gap: 18px;
  padding: 22px;
  margin-top: 18px;
  scroll-margin-top: 18px;
  background: #fff;
  border: 1px solid var(--vip-border);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgb(15 23 42 / 5%);
}

.organization-setup-card:focus {
  outline: 2px solid rgb(23 100 255 / 38%);
  outline-offset: 4px;
}

.organization-setup-card__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.organization-setup-card__head h2 {
  margin: 0;
  color: var(--vip-text);
}

.organization-setup-card__head p {
  max-width: 720px;
  margin: 10px 0 0;
  line-height: 1.75;
  color: var(--vip-text-soft);
}

.organization-setup-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.organization-identity-card,
.organization-invitation-card {
  display: grid;
  gap: 14px;
  align-content: start;
  padding: 16px;
  background: var(--vip-card-muted);
  border: 1px solid var(--vip-border);
  border-radius: 14px;
}

.organization-identity-card h3,
.organization-invitation-card h3 {
  margin: 0;
  font-size: 16px;
  color: var(--vip-text);
}

.organization-identity-card p,
.organization-invitation-card p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vip-text-soft);
}

.organization-identity-card__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.organization-identity-field {
  display: grid;
  gap: 8px;
}

.organization-identity-field span {
  font-size: 13px;
  font-weight: 600;
  color: var(--vip-text);
}

.organization-identity-card__error {
  color: #d4380d !important;
}

.order-card__agreement {
  margin-top: 20px;
}

.order-card__agreement-links {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  margin-left: 22px;
}

.order-card__agreement-links button {
  padding: 0;
  font-size: 13px;
  color: var(--vip-accent);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.order-card__agreement-hint {
  margin: 10px 0 0;
}

.order-card__actions {
  display: grid;
  gap: 12px;
  margin-top: 22px;
}

.mobile-checkout-bar {
  position: fixed;
  right: 16px;
  bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  left: 16px;
  z-index: 10;
  display: none;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgb(255 255 255 / 96%);
  backdrop-filter: blur(10px);
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 14px;
  box-shadow: 0 10px 28px rgb(15 23 42 / 12%);
}

.agreement-confirm {
  --agreement-link: #1764ff;
  --agreement-text: #1f2937;
}

.agreement-confirm p {
  margin: 0;
  line-height: 1.8;
  color: var(--agreement-text);
}

.agreement-confirm__links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.agreement-confirm__links button {
  padding: 0;
  font-weight: 600;
  color: var(--agreement-link);
  cursor: pointer;
  background: transparent;
  border: 0;
}

.membership-success {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.membership-success__icon {
  flex: 0 0 auto;
  margin-top: 2px;
  font-size: 34px;
}

.membership-success--success .membership-success__icon {
  color: #16a34a;
}

.membership-success--pending .membership-success__icon {
  color: #0ea5e9;
}

.membership-success--warning .membership-success__icon {
  color: #d97706;
}

.membership-success h3 {
  margin: 0;
  color: var(--vip-text);
}

.membership-success p {
  margin: 8px 0 0;
  line-height: 1.8;
  color: var(--vip-text-soft);
}

@media (max-width: 1100px) {
  .pay-layout {
    grid-template-columns: 1fr;
  }

  .pay-side {
    position: static;
  }
}

@media (max-width: 900px) {
  .vip-pay-page {
    padding: 16px 16px calc(128px + env(safe-area-inset-bottom, 0px));
  }

  .pay-alert {
    grid-template-columns: 1fr;
    padding: 20px;
  }

  .pay-head {
    grid-template-columns: 1fr;
    padding: 22px;
  }

  .organization-setup-card__grid,
  .organization-identity-card__fields {
    grid-template-columns: 1fr;
  }

  .benefit-grid {
    grid-template-columns: 1fr;
  }

  .pay-card,
  .order-card {
    padding: 20px;
  }

  .order-card__management {
    flex-direction: column;
    align-items: stretch;
  }

  .order-card__management > div {
    margin-right: 0;
    margin-bottom: 12px;
  }

  .pay-card h2 {
    font-size: 24px;
  }

  .mobile-checkout-bar {
    display: flex;
  }
}

@media (max-width: 640px) {
  .vip-pay-page {
    padding-right: 12px;
    padding-left: 12px;
  }

  .pay-alert,
  .pay-head,
  .pay-card,
  .order-card,
  .organization-setup-card {
    border-radius: 14px;
  }

  .organization-setup-card__head,
  .pay-card__head,
  .order-card__head {
    align-items: flex-start;
  }

  .pay-head h1 {
    font-size: 30px;
  }

  .pay-head__amount strong {
    font-size: 42px;
  }

  .order-card__row {
    align-items: flex-start;
  }

  .order-card__row span:last-child {
    text-align: right;
    word-break: break-word;
  }

  .mobile-checkout-bar {
    right: 12px;
    left: 12px;
  }
}
</style>
