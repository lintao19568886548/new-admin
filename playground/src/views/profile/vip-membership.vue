<script lang="ts" setup>
import type {
  TenantProvisioningStatus,
  WechatPayOrderStatus,
} from '#/api/wechat-pay';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, Checkbox, Input, message, Modal, Tag } from 'ant-design-vue';

import { joinTenantByInvitationCodeApi } from '#/api/tenant-invitation';
import { getTenantProvisioningStatus } from '#/api/wechat-pay';
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
const TENANT_PROVISIONING_PENDING_STATES = new Set(['pending', 'provisioning']);
const TENANT_PROVISIONING_PAYMENT_BLOCKED_STATES = new Set([
  'failed_manual',
  'failed_retryable',
  'pending',
  'provisioning',
]);

const membershipPlan = {
  name: 'VIP 月度会员',
  originalPrice: 1280,
  period: '月',
  price: MEMBERSHIP_AMOUNT_FEN / 100,
  savings: 300,
};
const RESTRICTED_PAGE_LABEL = '租赁管理、人员信息';

const benefitItems = [
  {
    description: '开通后可使用对应定位能力。',
    icon: 'mdi:map-marker-radius-outline',
    title: '定位服务',
  },
  {
    description: '开放招商相关能力入口。',
    icon: 'mdi:radar',
    title: '招商雷达',
  },
  {
    description: '支付完成后自动返回当前页面。',
    icon: 'mdi:flash-outline',
    title: '结果回页',
  },
  {
    description: '保留最近订单号，便于排查。',
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

interface ProfileTenantProvisioningState {
  label: string;
  status: string;
  targetCustomerId?: string;
}

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();

const agreedToTerms = ref(false);
const agreementModalOpen = ref(false);
const tenantCity = ref('');
const tenantCompanyShortName = ref('');
const tenantIdentityTouched = ref(false);
const tenantInvitationCode = ref('');
const tenantInvitationTouched = ref(false);
const tenantJoinLoading = ref(false);
const payLoading = ref(false);
const wechatConfigLoading = ref(false);
const latestPaymentState = ref<MembershipPaymentState | null>(null);
const latestTenantProvisioningStatus = ref<null | TenantProvisioningStatus>(
  null,
);
const paymentSectionRef = ref<HTMLElement | null>(null);
const wechatOpenAppId = ref('');

const userInfo = computed(() => userStore.userInfo);
const membershipAccessState = computed(() =>
  resolveMembershipAccessState(
    userInfo.value as null | Record<string, unknown> | undefined,
  ),
);
const displayName = computed(
  () => userInfo.value?.realName || userInfo.value?.username || '当前账号',
);
const currentCustomerId = computed(() =>
  typeof userInfo.value?.customerId === 'string'
    ? userInfo.value.customerId.trim()
    : '',
);
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
const profileMembershipState = computed<null | ProfileMembershipState>(() =>
  resolveProfileMembershipState(userInfo.value),
);
const profileTenantProvisioningState =
  computed<null | ProfileTenantProvisioningState>(() =>
    resolveProfileTenantProvisioningState(
      latestTenantProvisioningStatus.value || userInfo.value,
    ),
  );
const requiresTenantIdentity = computed(
  () =>
    currentCustomerId.value === 'public' &&
    !profileTenantProvisioningState.value,
);
const canJoinExistingTenant = computed(
  () =>
    currentCustomerId.value === 'public' &&
    !profileTenantProvisioningState.value,
);
const tenantInvitationError = computed(() => {
  if (!canJoinExistingTenant.value) {
    return '';
  }

  if (!tenantInvitationCode.value.trim()) {
    return '请输入企业邀请码';
  }

  return '';
});
const tenantIdentityError = computed(() => {
  if (!requiresTenantIdentity.value) {
    return '';
  }

  if (!tenantCity.value.trim()) {
    return '请填写租户公司所在城市';
  }

  if (!tenantCompanyShortName.value.trim()) {
    return '请填写租户公司简称';
  }

  return '';
});
const tenantIdentityReady = computed(() => !tenantIdentityError.value);
const tenantProvisioningPaymentBlocked = computed(() => {
  const status = profileTenantProvisioningState.value?.status;
  return Boolean(
    status && TENANT_PROVISIONING_PAYMENT_BLOCKED_STATES.has(status),
  );
});
const appPaySupported = computed(
  () => !!wechatOpenAppId.value && canUseNativeWechatPay(),
);
const payButtonText = computed(() => {
  if (payLoading.value) {
    return '正在处理支付...';
  }

  if (wechatConfigLoading.value) {
    return '正在读取支付配置...';
  }

  if (!wechatOpenAppId.value) {
    return '未配置微信支付';
  }

  if (!appPaySupported.value) {
    return '仅支持 Android App';
  }

  if (tenantProvisioningPaymentBlocked.value) {
    return profileTenantProvisioningState.value?.label || '专属空间开通中';
  }

  if (!tenantIdentityReady.value) {
    return '填写专属空间信息';
  }

  return `确认支付 ¥${membershipPlan.price}`;
});
const payButtonDisabled = computed(
  () =>
    payLoading.value ||
    wechatConfigLoading.value ||
    tenantProvisioningPaymentBlocked.value ||
    !wechatOpenAppId.value ||
    !appPaySupported.value,
);
const paymentAgreementHint = computed(() => {
  if (tenantProvisioningPaymentBlocked.value) {
    return (
      profileTenantProvisioningState.value?.label ||
      '专属空间正在开通中，请勿重复支付。'
    );
  }

  if (agreedToTerms.value) {
    return '已同意《会员服务协议》和《隐私政策》。';
  }

  if (requiresTenantIdentity.value) {
    return '支付前请填写专属空间信息，并阅读勾选相关协议。';
  }

  return '支付前请先阅读并勾选相关协议。';
});

watch(
  [userInfo, latestTenantProvisioningStatus],
  ([currentUserInfo, currentProvisioningStatus]) => {
    applyTenantIdentityDraft(currentProvisioningStatus || currentUserInfo);
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
        '当前账号仍保留在所属租户空间，但除租赁管理和人员信息外的页面已限制访问。续费后恢复全部功能。',
      eyebrow: 'Membership Expired',
      title: '会员已过期',
    };
  }

  return {
    description:
      '免费试用期已结束，目前仅保留租赁管理和人员信息两个页面可用。开通会员后恢复全部功能。',
    eyebrow: 'Trial Ended',
    title: '试用已到期',
  };
});
const orderStatusTag = computed(() => {
  if (profileTenantProvisioningState.value) {
    const status = profileTenantProvisioningState.value.status;
    return {
      color: resolveTenantProvisioningTagColor(status),
      text: profileTenantProvisioningState.value.label,
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

function resolveTenantProvisioningTagColor(status: string) {
  if (status === 'failed_manual') {
    return 'error';
  }

  if (status === 'failed_retryable') {
    return 'warning';
  }

  return 'processing';
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
        label = `会员有效至 ${formatMembershipExpireAt(expireAtField.value)}`;
      } else if (active) {
        label = '会员已开通';
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
    let label = '未开通';
    if (booleanField.value && expireAtField?.value) {
      label = `会员有效至 ${formatMembershipExpireAt(expireAtField.value)}`;
    } else if (booleanField.value) {
      label = '会员已开通';
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
          ? `会员有效至 ${formatMembershipExpireAt(expireAtField.value)}`
          : '会员已过期',
        sourceField: expireAtField.field,
      };
    }
  }

  return null;
}

function resolveProfileTenantProvisioningState(
  value: null | object | undefined,
): null | ProfileTenantProvisioningState {
  if (!value) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const status = readStringField(record, ['tenantProvisioningStatus'])?.value;
  if (!status || ['active', 'none'].includes(status)) {
    return null;
  }

  const message = readStringField(record, ['tenantProvisioningMessage'])?.value;
  const targetCustomerId = readStringField(record, ['targetCustomerId'])?.value;

  return {
    label: message || '专属空间开通中',
    status,
    targetCustomerId,
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
    membershipAccessState.value.accessRestricted
      ? '/rental/manage'
      : '/profile',
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
    return '支付已完成，但会员开通状态未确认，请稍后刷新或联系客服处理。';
  }

  if (result.reason === 'amount-mismatch') {
    return '支付金额异常，会员未开通，请联系客服处理退款或对账。';
  }

  if (
    [
      'missing-center-user',
      'missing-out-trade-no',
      'missing-user-context',
      'not-vip-membership',
    ].includes(result.reason || '')
  ) {
    return '支付订单归属信息异常，会员未开通，请联系客服处理。';
  }

  return '支付已完成，但会员开通未生效，请联系客服处理。';
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

  message.info('如支付遇到问题，请联系客服处理；会员开通以订单状态为准。');
}

function handleMobileCheckoutNavigate() {
  const paymentSection = paymentSectionRef.value;
  if (!paymentSection) {
    return;
  }

  const behavior: ScrollBehavior = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
    ? 'auto'
    : 'smooth';

  paymentSection.focus({ preventScroll: true });
  paymentSection.scrollIntoView({ behavior, block: 'start' });
}

function applyTenantIdentityDraft(value: null | object | undefined) {
  if (!value || tenantIdentityTouched.value) {
    return;
  }

  const record = value as Record<string, unknown>;
  const draftCity = readStringField(record, ['targetCity'])?.value;
  const draftCompanyShortName = readStringField(record, [
    'targetCompanyShortName',
  ])?.value;

  if (draftCity && !tenantCity.value.trim()) {
    tenantCity.value = draftCity;
  }

  if (draftCompanyShortName && !tenantCompanyShortName.value.trim()) {
    tenantCompanyShortName.value = draftCompanyShortName;
  }
}

function resolveTenantIdentityPayload() {
  if (!requiresTenantIdentity.value) {
    return undefined;
  }

  return {
    city: tenantCity.value.trim(),
    companyShortName: tenantCompanyShortName.value.trim(),
  };
}

function validateTenantIdentity() {
  tenantIdentityTouched.value = true;
  if (!tenantIdentityError.value) {
    return true;
  }

  handleMobileCheckoutNavigate();
  return false;
}

async function handleJoinExistingTenant() {
  if (tenantJoinLoading.value) {
    return;
  }

  tenantInvitationTouched.value = true;
  if (tenantInvitationError.value) {
    return;
  }

  tenantJoinLoading.value = true;
  try {
    const result = await joinTenantByInvitationCodeApi(
      tenantInvitationCode.value.trim(),
    );
    if (result.requiresRelogin) {
      message.success(
        `已加入 ${result.customerName || '目标租户'}，请重新登录进入企业空间。`,
      );
      await authStore.logout(false, false);
      return;
    }

    message.success('当前账号已在该企业空间。');
    await authStore.fetchUserInfo();
  } finally {
    tenantJoinLoading.value = false;
  }
}

async function refreshWechatPayAppConfig(options: { silent?: boolean } = {}) {
  if (wechatOpenAppId.value) {
    return wechatOpenAppId.value;
  }

  wechatConfigLoading.value = true;
  try {
    const config = await loadWechatPayAppConfig();
    wechatOpenAppId.value = config.appId;
    return wechatOpenAppId.value;
  } catch (error) {
    console.error('获取微信支付配置失败:', error);
    if (!options.silent) {
      message.error(
        error instanceof Error ? error.message : '获取微信支付配置失败',
      );
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

  if (tenantProvisioningPaymentBlocked.value) {
    return;
  }

  if (!validateTenantIdentity()) {
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

  if (tenantProvisioningPaymentBlocked.value) {
    agreementModalOpen.value = false;
    return;
  }

  const currentWechatOpenAppId = await refreshWechatPayAppConfig();
  if (!currentWechatOpenAppId) {
    message.error('未获取到微信开放平台移动应用 AppID');
    return;
  }

  if (!validateTenantIdentity()) {
    return;
  }

  agreedToTerms.value = true;
  agreementModalOpen.value = false;
  await handleWechatPay();
}

async function refreshUserProfileAfterPaid() {
  try {
    const refreshedUserInfo = await authStore.fetchUserInfo();
    if (
      refreshedUserInfo &&
      !resolveMembershipAccessState(
        refreshedUserInfo as unknown as Record<string, unknown>,
      ).accessRestricted
    ) {
      const nextQuery = { ...route.query };
      let queryChanged = false;

      for (const key of ['from', 'reason', 'source'] as const) {
        if (!(key in nextQuery)) {
          continue;
        }
        delete nextQuery[key];
        queryChanged = true;
      }

      if (queryChanged) {
        await router.replace({
          hash: route.hash,
          path: route.path,
          query: nextQuery,
        });
      }
    }
  } catch (error) {
    console.warn('支付成功后刷新用户资料失败:', error);
  }
}

async function refreshTenantProvisioningStatus(checkoutFlowToken?: string) {
  const state = await getTenantProvisioningStatus({
    checkoutFlowToken,
  });
  latestTenantProvisioningStatus.value = state;
  return state;
}

async function pollTenantProvisioningStatusAfterPaid(
  checkoutFlowToken?: string,
) {
  let lastStatus: null | TenantProvisioningStatus = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const currentStatus =
      await refreshTenantProvisioningStatus(checkoutFlowToken);
    lastStatus = currentStatus;

    if (
      !TENANT_PROVISIONING_PENDING_STATES.has(
        currentStatus.tenantProvisioningStatus,
      )
    ) {
      return currentStatus;
    }

    await sleep((attempt + 1) * 1800);
  }

  return lastStatus;
}

async function handleWechatPay() {
  if (payLoading.value) {
    return;
  }

  if (!agreedToTerms.value) {
    agreementModalOpen.value = true;
    return;
  }

  if (tenantProvisioningPaymentBlocked.value) {
    return;
  }

  if (!validateTenantIdentity()) {
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

  message.loading({
    content: '正在创建微信支付订单...',
    duration: 0,
    key: PAY_MESSAGE_KEY,
  });

  try {
    const execution = await payWithWechatApp({
      amount: MEMBERSHIP_AMOUNT_FEN,
      attach: 'vip-membership',
      description: `${displayName.value} VIP 月度会员`,
      deviceId: 'vip-membership-page',
      tenantIdentity: resolveTenantIdentityPayload(),
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
      await refreshTenantProvisioningStatus(execution.checkoutFlowToken).catch(
        (error) => {
          console.warn('旧支付订单同步后刷新专属空间状态失败:', error);
        },
      );
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
      let provisioningStatus: null | TenantProvisioningStatus = null;
      try {
        provisioningStatus = await pollTenantProvisioningStatusAfterPaid(
          execution.checkoutFlowToken,
        );
      } catch (error) {
        console.warn('支付成功后刷新专属空间状态失败:', error);
      }

      if (!provisioningStatus?.requiresRelogin) {
        await refreshUserProfileAfterPaid();
      }
      message.success({
        content: provisioningStatus?.requiresRelogin
          ? '专属空间已开通，请重新登录进入专属空间。'
          : provisioningStatus?.tenantProvisioningMessage ||
            '支付成功，专属空间状态同步中，请稍后刷新。',
        duration: 4,
        key: PAY_MESSAGE_KEY,
      });
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
  void refreshTenantProvisioningStatus().catch((error) => {
    console.warn('读取专属空间草稿失败:', error);
  });
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

      <div v-if="canJoinExistingTenant" class="tenant-invitation-card">
        <div>
          <h3>已有企业邀请码？</h3>
          <p>
            如果公司已经开通专属空间，可输入管理员提供的邀请码加入。
            加入成功后需要重新登录。
          </p>
        </div>
        <label class="tenant-identity-field">
          <span>企业邀请码</span>
          <Input
            v-model:value="tenantInvitationCode"
            placeholder="输入企业邀请码"
            @blur="tenantInvitationTouched = true"
            @press-enter="handleJoinExistingTenant"
          />
        </label>
        <p
          v-if="tenantInvitationTouched && tenantInvitationError"
          class="tenant-identity-card__error"
        >
          {{ tenantInvitationError }}
        </p>
        <Button
          block
          :loading="tenantJoinLoading"
          @click="handleJoinExistingTenant"
        >
          加入已有租户
        </Button>
      </div>

      <section class="pay-head">
        <div class="pay-head__intro">
          <p class="pay-head__eyebrow">Membership Checkout</p>
          <h1>开通会员服务</h1>
          <p class="pay-head__description">
            为
            {{ displayName }}
            开通月度会员后，可使用定位服务、招商雷达等会员专属能力。
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
                <h2>会员权益</h2>
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
              <span>开通账号</span>
              <strong>{{ displayName }}</strong>
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
              <div
                v-if="profileMembershipState?.active"
                class="order-card__row order-card__row--wrap"
              >
                <span>账号会员状态</span>
                <span>{{ profileMembershipState.label }}</span>
              </div>
              <div
                v-if="profileTenantProvisioningState"
                class="order-card__row order-card__row--wrap"
              >
                <span>专属空间</span>
                <span>
                  {{ profileTenantProvisioningState.label }}
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

            <div v-if="requiresTenantIdentity" class="tenant-identity-card">
              <div>
                <h3>租户公司信息</h3>
                <p>
                  用于生成独立数据库标识，如
                  深圳市腾讯计算机系统有限公司，填深圳市、腾讯
                </p>
              </div>
              <label class="tenant-identity-field">
                <span>所在城市</span>
                <Input
                  v-model:value="tenantCity"
                  placeholder="如 深圳市"
                  @blur="tenantIdentityTouched = true"
                />
              </label>
              <label class="tenant-identity-field">
                <span>公司简称</span>
                <Input
                  v-model:value="tenantCompanyShortName"
                  placeholder="如 腾讯"
                  @blur="tenantIdentityTouched = true"
                />
              </label>
              <p
                v-if="tenantIdentityTouched && tenantIdentityError"
                class="tenant-identity-card__error"
              >
                {{ tenantIdentityError }}
              </p>
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
        {{ payLoading ? '处理中...' : '去支付' }}
      </Button>
    </div>

    <Modal
      v-model:open="agreementModalOpen"
      centered
      cancel-text="取消"
      ok-text="同意并支付"
      title="确认会员服务协议"
      :confirm-loading="payLoading"
      :mask-closable="!payLoading"
      :ok-button-props="{ disabled: payButtonDisabled }"
      @ok="handleAgreementModalConfirm"
    >
      <div class="agreement-confirm">
        <p>
          开通会员前，请先阅读并同意《会员服务协议》和《隐私政策》。确认后将直接发起微信支付。
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
  </div>
</template>

<style scoped>
.vip-pay-page {
  --vip-page-bg:
    radial-gradient(circle at top, rgb(255 243 220 / 48%), transparent 34%),
    linear-gradient(180deg, #f7f8fb 0%, #eef2f7 48%, #fff 100%);
  --vip-border: rgb(15 23 42 / 8%);
  --vip-card: rgb(255 255 255 / 92%);
  --vip-card-strong: rgb(255 255 255 / 98%);
  --vip-text: #1f2937;
  --vip-text-soft: #667085;
  --vip-accent: #1764ff;
  --vip-shadow: 0 16px 40px rgb(15 23 42 / 8%);

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
  padding: 22px 24px;
  margin-top: 18px;
  background:
    linear-gradient(135deg, rgb(255 248 235 / 96%), rgb(255 255 255 / 98%)),
    #fff;
  border: 1px solid rgb(183 121 31 / 20%);
  border-radius: 24px;
  box-shadow: 0 12px 28px rgb(15 23 42 / 6%);
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
  background: rgb(23 100 255 / 5%);
  border-radius: 18px;
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
  background:
    linear-gradient(
      135deg,
      rgb(255 250 239 / 92%),
      rgb(255 255 255 / 98%) 46%,
      rgb(244 248 255 / 96%)
    ),
    #fff;
  border: 1px solid var(--vip-border);
  border-radius: 28px;
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
  background: var(--vip-card-strong);
  border: 1px solid rgb(183 121 31 / 16%);
  border-radius: 24px;
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
  border-radius: 28px;
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
  background: rgb(255 255 255 / 86%);
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
  background:
    linear-gradient(180deg, rgb(23 100 255 / 4%), rgb(255 255 255 / 98%)), #fff;
  border: 1px solid rgb(23 100 255 / 12%);
  border-radius: 22px;
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
  background: rgb(23 100 255 / 5%);
  border-radius: 20px;
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
.order-card__payment-result {
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

.tenant-identity-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  margin-top: 20px;
  background:
    linear-gradient(135deg, rgb(23 100 255 / 6%), rgb(255 255 255 / 96%)), #fff;
  border: 1px solid rgb(23 100 255 / 14%);
  border-radius: 20px;
}

.tenant-invitation-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  margin-top: 20px;
  background:
    linear-gradient(135deg, rgb(20 184 166 / 7%), rgb(255 255 255 / 96%)), #fff;
  border: 1px solid rgb(20 184 166 / 18%);
  border-radius: 20px;
}

.tenant-invitation-card h3 {
  margin: 0;
  font-size: 16px;
  color: var(--vip-text);
}

.tenant-invitation-card p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vip-text-soft);
}

.tenant-identity-card h3 {
  margin: 0;
  font-size: 16px;
  color: var(--vip-text);
}

.tenant-identity-card p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--vip-text-soft);
}

.tenant-identity-field {
  display: grid;
  gap: 8px;
}

.tenant-identity-field span {
  font-size: 13px;
  font-weight: 600;
  color: var(--vip-text);
}

.tenant-identity-card__error {
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
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
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
  border-radius: 20px;
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

  .benefit-grid {
    grid-template-columns: 1fr;
  }

  .pay-card,
  .order-card {
    padding: 20px;
  }

  .pay-card h2 {
    font-size: 24px;
  }

  .mobile-checkout-bar {
    display: flex;
  }
}

@media (max-width: 640px) {
  .pay-head h1 {
    font-size: 30px;
  }

  .pay-head__amount strong {
    font-size: 42px;
  }
}
</style>
