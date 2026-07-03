<script lang="ts" setup>
import type {
  ProfileMenuAction,
  ProfileMenuEntry,
} from './modules/profile-menu-types';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import {
  ChevronRight,
  LockKeyhole,
  LogOut,
  RotateCw,
  SvgCardIcon,
} from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Avatar, Card, message, Modal, Tag } from 'ant-design-vue';

import { cancelCurrentUserApi } from '#/api';
import BusinessCard from '#/components/Businesscard.vue';
import { useAuthStore } from '#/store';
import {
  openPrivacyPolicyDialog,
  openServiceAgreementDialog,
} from '#/utils/policy-actions';
import { requireLogin } from '#/utils/require-login';
import { checkAppUpdate } from '#/utils/update-service';
import EditPassword from '#/views/_core/authentication/edit-password.vue';

import FeedbackModal from './modules/feedback-modal.vue';
import ProfileMenu from './modules/ProfileMenu.vue';

const userStore = useUserStore();
const authStore = useAuthStore();
const router = useRouter();

const userInfo = computed(() => userStore.userInfo);
const isLoggedIn = computed(() => Boolean(userInfo.value));
const showPasswordModal = ref(false);
const showFeedbackModal = ref(false);
const specialCustomerIds = new Set(['center', 'default', 'public']);
const currentCustomerId = computed(() =>
  String((userInfo.value as any)?.customerId || ''),
);
const ORGANIZATION_PROVISIONING_BLOCKING_STATUSES = new Set([
  'failed_manual',
  'failed_retryable',
  'pending',
  'provisioning',
]);
const sourceOrganizationState = computed(() => {
  const record = userInfo.value as Record<string, unknown> | undefined;
  const sourceOrganization = record?.sourceOrganization;
  if (!sourceOrganization || typeof sourceOrganization !== 'object') {
    return null;
  }

  const organizationRecord = sourceOrganization as Record<string, unknown>;
  const id = Number(organizationRecord.id);
  const sourceCustomerId = readStringField(
    organizationRecord,
    'sourceCustomerId',
  );
  if (!Number.isInteger(id) || id <= 0 || !sourceCustomerId) {
    return null;
  }

  return {
    id,
    sourceCustomerId,
  };
});
const sourceOrganizationCount = computed(() => {
  const record = userInfo.value as Record<string, unknown> | undefined;
  const count = Number(record?.sourceOrganizationCount ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
});
const organizationProvisioningStatus = computed(() => {
  const record = userInfo.value as Record<string, unknown> | undefined;
  return readStringField(record || {}, 'organizationProvisioningStatus');
});
const canManageOrganizationInvitations = computed(
  () =>
    Boolean(currentCustomerId.value) &&
    !['default', 'public'].includes(currentCustomerId.value),
);
const canCreateOrganizationSpace = computed(
  () =>
    currentCustomerId.value === 'public' &&
    !sourceOrganizationState.value &&
    sourceOrganizationCount.value === 0 &&
    !ORGANIZATION_PROVISIONING_BLOCKING_STATUSES.has(
      organizationProvisioningStatus.value,
    ),
);
const membershipStatusBar = computed(() => {
  const record = userInfo.value as Record<string, unknown> | undefined;
  if (!record) {
    return null;
  }

  const customerId = currentCustomerId.value;
  if (customerId === 'public') {
    const accessScopeStatus = readStringField(record, 'accessScopeStatus');
    const membershipGateReason = readStringField(
      record,
      'membershipGateReason',
    );
    const trialStatus = readStringField(record, 'trialStatus');
    const trialExpireAt = readStringField(record, 'trialExpireAt');
    const isTrialActive = readBooleanField(record, 'isTrialActive');
    const shouldShow =
      accessScopeStatus === 'trial_active' ||
      membershipGateReason === 'trial_expired' ||
      Boolean(trialStatus || trialExpireAt);

    if (!shouldShow) {
      return null;
    }

    const expireLabel = trialExpireAt
      ? formatDateLabel(trialExpireAt)
      : '待同步';
    const remainingLabel = trialExpireAt
      ? formatRemainingTime(trialExpireAt)
      : '';
    const active =
      isTrialActive === true ||
      accessScopeStatus === 'trial_active' ||
      trialStatus === 'active';
    const expired =
      trialStatus === 'expired' ||
      membershipGateReason === 'trial_expired' ||
      isTrialActive === false;

    if (active) {
      return {
        description: remainingLabel
          ? `有效至 ${expireLabel}，${remainingLabel}`
          : `有效至 ${expireLabel}`,
        icon: 'mdi:timer-check-outline',
        statusText: '试用中',
        tagColor: 'success',
        title: '免费试用期',
        tone: 'active',
      };
    }

    if (expired) {
      return {
        description: `已于 ${expireLabel} 到期`,
        icon: 'mdi:timer-alert-outline',
        statusText: '已到期',
        tagColor: 'warning',
        title: '免费试用期',
        tone: 'expired',
      };
    }

    return {
      description: '试用状态正在同步',
      icon: 'mdi:timer-sand',
      statusText: '待同步',
      tagColor: 'processing',
      title: '免费试用期',
      tone: 'unknown',
    };
  }

  if (!customerId || specialCustomerIds.has(customerId)) {
    return null;
  }

  const accessScopeStatus = readStringField(record, 'accessScopeStatus');
  const membershipExpireAt =
    readStringField(record, 'membershipExpireAt') ||
    readStringField(record, 'vipExpireAt') ||
    readStringField(record, 'memberExpireAt');
  const membershipGateReason = readStringField(record, 'membershipGateReason');
  const membershipStatus =
    readStringField(record, 'membershipStatus') ||
    readStringField(record, 'vipStatus') ||
    readStringField(record, 'memberStatus');
  const expireLabel = membershipExpireAt
    ? formatDateLabel(membershipExpireAt)
    : '';
  const remainingLabel = membershipExpireAt
    ? formatRemainingTime(membershipExpireAt)
    : '';
  const active =
    membershipStatus === 'active' || accessScopeStatus === 'member_active';

  if (active) {
    return {
      description: remainingLabel
        ? `有效至 ${expireLabel}，${remainingLabel}`
        : `有效至 ${expireLabel}`,
      icon: 'mdi:crown-outline',
      statusText: '会员在期',
      tagColor: 'success',
      title: '付费会员生效中',
      tone: 'active',
    };
  }

  return {
    description:
      membershipExpireAt && membershipGateReason === 'membership_expired'
        ? `已于 ${expireLabel} 到期`
        : '暂无有效会员期限',
    icon: 'mdi:crown-off-outline',
    statusText: '会员过期',
    tagColor: 'warning',
    title: '付费会员期限',
    tone: 'expired',
  };
});

function readBooleanField(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'boolean' ? (record[key] as boolean) : null;
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('zh-CN');
}

function formatRemainingTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const remainingMs = date.getTime() - Date.now();
  if (remainingMs <= 0) {
    return '已到期';
  }

  const dayMs = 24 * 60 * 60 * 1000;
  if (remainingMs < dayMs) {
    return '剩余不足 1 天';
  }

  return `剩余 ${Math.ceil(remainingMs / dayMs)} 天`;
}

/**
 * 初始化通知功能（包括本地通知和推送通知）
 */
async function initNotifications() {
  if (Capacitor.getPlatform() === 'android') {
    try {
      // 请求本地通知权限
      const localPermStatus = await LocalNotifications.requestPermissions();
      console.warn('本地通知权限状态:', localPermStatus.display);

      const hasLocalNotification = localPermStatus.display === 'granted';

      return hasLocalNotification;
    } catch (error) {
      console.error('初始化通知功能失败:', error);
      return false;
    }
  }
  return false;
}

/**
 * 发送本地推送通知（用于调试）
 */
// async function sendDebugNotification(title: string, body: string) {
//   if (Capacitor.getPlatform() === 'android') {
//     try {
//       await LocalNotifications.schedule({
//         notifications: [
//           {
//             actionTypeId: '',
//             attachments: [],
//             body,
//             extra: {},
//             // 使用整数作为id,避免使用Date.now()可能产生的小数
//             id: Math.floor(Math.random() * 100_000),
//             schedule: { at: new Date(Date.now() + 100) }, // 100ms后显示
//             sound: 'default',
//             title,
//           },
//         ],
//       });
//     } catch (error) {
//       console.error('发送调试通知失败:', error);
//       // 如果本地通知失败，回退到普通消息提示
//       message.info(`${title}: ${body}`);
//     }
//   } else {
//     // 非Android平台使用消息提示
//     message.info(`${title}: ${body}`);
//   }
// }

// 组件挂载时初始化通知功能
onMounted(async () => {
  if (isNative) {
    // 初始化通知功能
    await initNotifications();
  }
});

/**
 * 手动检查更新（显示加载提示和成功提示，需要用户确认后安装）
 */
async function handleCheckUpdate() {
  await checkAppUpdate(true, true, false);
}

async function handleCancelAccount() {
  if (!(await requireLogin(router, '/profile'))) {
    return;
  }

  const currentUser = userInfo.value as null | {
    id?: number;
    realName?: string;
    username?: string;
  };
  const currentUserId = Number(currentUser?.id || 0);
  if (!Number.isFinite(currentUserId) || currentUserId <= 0) {
    message.error('未获取到当前账号信息，暂时无法注销');
    return;
  }

  const displayName =
    currentUser?.realName || currentUser?.username || '当前账号';

  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: `账号注销后将无法继续登录，${displayName} 的权限信息会被清除，且该操作不可恢复，是否继续？`,
    okButtonProps: {
      danger: true,
    },
    okText: '确认注销',
    onOk: async () => {
      const messageKey = 'account_cancel_msg';

      message.loading({
        content: '账号注销中...',
        duration: 0,
        key: messageKey,
      });

      try {
        await cancelCurrentUserApi();
        message.success({
          content: '账号已注销',
          key: messageKey,
        });
        await authStore.logout(false, false);
      } catch (error) {
        console.error('账号注销失败:', error);
        message.error({
          content: '账号注销失败，请稍后重试',
          key: messageKey,
        });
      }
    },
    title: '账号注销',
  });
}

function handleLogout() {
  if (!isLoggedIn.value) {
    void router.push('/auth/login?redirect=%2Fprofile');
    return;
  }

  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content: '您确定要退出登录吗？',
    okText: '确认',
    onOk: async () => {
      await authStore.logout(false);
      message.success('已退出登录');
    },
    title: '温馨提示',
  });
}

const showBusinessCard = ref(false);

async function handleCreateBusinessCard() {
  if (!(await requireLogin(router, '/profile'))) {
    return;
  }

  showBusinessCard.value = true;
}

function handleOpenFeedback() {
  showFeedbackModal.value = true;
}

async function handleOpenVipMembership() {
  if (!(await requireLogin(router, '/profile/vip-membership'))) {
    return;
  }

  void router.push({ name: 'ProfileVipMembership' });
}

async function handleOpenOrganizationCreate() {
  if (!(await requireLogin(router, '/profile/vip-membership?section=org'))) {
    return;
  }

  void router.push({ name: 'ProfileVipMembership', query: { section: 'org' } });
}

async function handleOpenOrganizationInvitations() {
  if (!(await requireLogin(router, '/profile/organization-invitations'))) {
    return;
  }

  void router.push({ name: 'ProfileOrganizationInvitations' });
}

function handleOpenPrivacyPolicy() {
  openPrivacyPolicyDialog();
}

function handleOpenServiceAgreement() {
  openServiceAgreementDialog();
}

async function handleOpenSmartService() {
  if (!(await requireLogin(router, '/profile/smart-service'))) {
    return;
  }

  void router.push('/profile/smart-service').catch((error) => {
    console.error('打开智能客服失败:', error);
    message.error('智能客服页面打开失败，请稍后重试');
  });
}

// function handleEditProfile() {
//   message.info('该功能正在开发中...');
// }

async function handleChangePassword() {
  if (!(await requireLogin(router, '/profile'))) {
    return;
  }

  showPasswordModal.value = true;
}

async function handlePasswordChanged() {
  message.success('密码修改成功，请重新登录');
  // 延迟一下让用户看到成功提示
  setTimeout(async () => {
    await authStore.logout(false);
  });
}

const isNative = Capacitor.isNativePlatform();
// const isNative = true;

const menuItems = computed<ProfileMenuEntry[]>(() => {
  if (!isLoggedIn.value) {
    return [
      {
        handler: handleLogout,
        icon: LogOut,
        key: 'login',
        title: '登录',
      },
      {
        handler: handleOpenPrivacyPolicy,
        icon: 'mdi:shield-account-outline',
        key: 'privacyPolicy',
        title: '隐私政策',
      },
      {
        handler: handleOpenServiceAgreement,
        icon: 'mdi:file-document-outline',
        key: 'serviceAgreement',
        title: '服务协议',
      },
    ];
  }

  const moreFunctions = [
    // {
    //   handler: handleEditProfile,
    //   icon: UserRoundPen,
    //   key: 'editProfile',
    //   title: '修改个人信息',
    // },
    ...(canCreateOrganizationSpace.value
      ? [
          {
            handler: handleOpenOrganizationCreate,
            icon: 'mdi:domain-plus',
            key: 'organizationCreate',
            title: '创建组织空间',
          },
        ]
      : []),
    {
      handler: handleOpenVipMembership,
      icon: 'mdi:crown-outline',
      key: 'vipMembership',
      title: '会员服务',
    },
    ...(canManageOrganizationInvitations.value
      ? [
          {
            handler: handleOpenOrganizationInvitations,
            icon: 'mdi:ticket-confirmation-outline',
            key: 'tenantInvitations',
            title: '企业邀请码',
          },
        ]
      : []),
    {
      handler: handleCreateBusinessCard,
      icon: SvgCardIcon,
      key: 'businessCard',
      title: '个人名片',
    },
    {
      handler: handleOpenPrivacyPolicy,
      icon: 'mdi:shield-account-outline',
      key: 'privacyPolicy',
      title: '隐私政策',
    },
    {
      handler: handleOpenServiceAgreement,
      icon: 'mdi:file-document-outline',
      key: 'serviceAgreement',
      title: '服务协议',
    },
    {
      danger: true,
      handler: handleCancelAccount,
      icon: 'mdi:account-remove-outline',
      key: 'cancelAccount',
      title: '账号注销',
    },
  ];

  const flatActions: ProfileMenuAction[] = [
    {
      handler: handleChangePassword,
      icon: LockKeyhole,
      key: 'changePassword',
      title: '修改密码',
    },
    {
      handler: handleOpenFeedback,
      icon: 'mdi:message-text-outline',
      key: 'feedback',
      title: '意见反馈',
    },
    {
      handler: handleOpenSmartService,
      icon: 'mdi:robot-outline',
      key: 'smartService',
      title: '智能客服',
    },
  ];

  if (isNative) {
    flatActions.push({
      handler: handleCheckUpdate,
      icon: RotateCw,
      key: 'checkUpdate',
      title: '检查更新',
    });
  }

  flatActions.push({
    handler: handleLogout,
    icon: LogOut,
    key: 'logout',
    title: '退出登录',
  });

  return [
    {
      icon: 'mdi:dots-grid',
      key: 'moreFunctions',
      title: '更多功能',
      type: 'dropdown',
      children: moreFunctions,
    },
    ...flatActions,
  ];
});
</script>

<template>
  <div class="p-3">
    <Card :bordered="false" class="mb-3">
      <div class="flex flex-col items-center justify-center py-4">
        <Avatar :size="64" :src="userInfo?.avatar" />
        <div class="mt-3 text-lg font-semibold">
          {{ userInfo?.realName || '未登录' }}
        </div>
        <button
          v-if="!isLoggedIn"
          class="mt-3 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm"
          type="button"
          @click="handleLogout"
        >
          登录
        </button>
      </div>
    </Card>

    <button
      v-if="membershipStatusBar"
      class="membership-status-bar mb-3"
      :class="`membership-status-bar--${membershipStatusBar.tone}`"
      type="button"
      @click="handleOpenVipMembership"
    >
      <span class="membership-status-bar__icon-wrap">
        <VbenIcon
          :icon="membershipStatusBar.icon"
          class="membership-status-bar__icon"
        />
      </span>
      <span class="membership-status-bar__content">
        <span class="membership-status-bar__title">
          {{ membershipStatusBar.title }}
        </span>
        <span class="membership-status-bar__description">
          {{ membershipStatusBar.description }}
        </span>
      </span>
      <Tag
        :color="membershipStatusBar.tagColor"
        class="membership-status-bar__tag"
      >
        {{ membershipStatusBar.statusText }}
      </Tag>
      <VbenIcon :icon="ChevronRight" class="membership-status-bar__arrow" />
    </button>

    <Card :bordered="false" class="profile-menu-card">
      <ProfileMenu :items="menuItems" />
    </Card>

    <FeedbackModal v-model:open="showFeedbackModal" />

    <!-- 添加修改密码模态框 -->
    <EditPassword
      v-model:open="showPasswordModal"
      @success="handlePasswordChanged"
    />

    <!-- 个人名片模态框 -->
    <BusinessCard
      v-if="showBusinessCard"
      :user-info="userInfo"
      @close="showBusinessCard = false"
    />
  </div>
</template>

<style scoped>
.membership-status-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid rgb(15 23 42 / 8%);
  border-radius: 12px;
  box-shadow: 0 6px 18px rgb(15 23 42 / 5%);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.membership-status-bar:hover {
  border-color: rgb(22 100 255 / 24%);
  box-shadow: 0 8px 22px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.membership-status-bar--active {
  background: linear-gradient(90deg, rgb(240 253 244 / 98%), #fff 52%);
  border-color: rgb(22 163 74 / 18%);
}

.membership-status-bar--expired {
  background: linear-gradient(90deg, rgb(255 251 235 / 98%), #fff 52%);
  border-color: rgb(217 119 6 / 20%);
}

.membership-status-bar--unknown {
  background: linear-gradient(90deg, rgb(239 246 255 / 98%), #fff 52%);
  border-color: rgb(14 165 233 / 16%);
}

.membership-status-bar__icon-wrap {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: #1764ff;
  background: rgb(23 100 255 / 9%);
  border-radius: 10px;
}

.membership-status-bar--active .membership-status-bar__icon-wrap {
  color: #16a34a;
  background: rgb(22 163 74 / 10%);
}

.membership-status-bar--expired .membership-status-bar__icon-wrap {
  color: #d97706;
  background: rgb(217 119 6 / 11%);
}

.membership-status-bar__icon {
  font-size: 21px;
}

.membership-status-bar__content {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.membership-status-bar__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.membership-status-bar__description {
  overflow: hidden;
  font-size: 13px;
  color: #667085;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.membership-status-bar__tag {
  flex: 0 0 auto;
  margin-right: 0;
}

.membership-status-bar__arrow {
  flex: 0 0 auto;
  font-size: 16px;
  color: #98a2b3;
}

@media (max-width: 420px) {
  .membership-status-bar {
    gap: 10px;
    padding: 10px 12px;
  }

  .membership-status-bar__description {
    white-space: normal;
  }

  .membership-status-bar__tag {
    display: none;
  }
}

:deep(.profile-menu-card .ant-card-body) {
  padding: 0;
}
</style>
