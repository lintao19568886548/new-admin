<script lang="ts" setup>
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
import {
  Avatar,
  Card,
  List,
  ListItem,
  message,
  Modal,
  Tag,
} from 'ant-design-vue';

import { cancelCurrentUserApi } from '#/api';
import BusinessCard from '#/components/Businesscard.vue';
import { useAuthStore } from '#/store';
import {
  openPrivacyPolicyDialog,
  openServiceAgreementDialog,
} from '#/utils/policy-actions';
import { checkAppUpdate } from '#/utils/update-service';
import EditPassword from '#/views/_core/authentication/edit-password.vue';

import FeedbackModal from './modules/feedback-modal.vue';

const userStore = useUserStore();
const authStore = useAuthStore();
const router = useRouter();

const userInfo = computed(() => userStore.userInfo);
const showPasswordModal = ref(false);
const showFeedbackModal = ref(false);
const currentCustomerId = computed(() =>
  String((userInfo.value as any)?.customerId || ''),
);
const currentUserRoles = computed(() => {
  const roles = (userInfo.value as any)?.roles;
  return Array.isArray(roles) ? roles.map(String) : [];
});
const canManageTenantInvitations = computed(
  () =>
    currentUserRoles.value.includes('Super') &&
    Boolean(currentCustomerId.value) &&
    !['default', 'public'].includes(currentCustomerId.value),
);
const trialStatusBar = computed(() => {
  const record = userInfo.value as Record<string, unknown> | undefined;
  if (!record) {
    return null;
  }

  const customerId = currentCustomerId.value;
  if (customerId !== 'public') {
    return null;
  }

  const accessScopeStatus = readStringField(record, 'accessScopeStatus');
  const membershipGateReason = readStringField(record, 'membershipGateReason');
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

  const expireLabel = trialExpireAt ? formatDateLabel(trialExpireAt) : '待同步';
  const remainingLabel = trialExpireAt
    ? formatTrialRemainingTime(trialExpireAt)
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
      tone: 'active',
    };
  }

  if (expired) {
    return {
      description: `已于 ${expireLabel} 到期`,
      icon: 'mdi:timer-alert-outline',
      statusText: '已到期',
      tagColor: 'warning',
      tone: 'expired',
    };
  }

  return {
    description: '试用状态正在同步',
    icon: 'mdi:timer-sand',
    statusText: '待同步',
    tagColor: 'processing',
    tone: 'unknown',
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

function formatTrialRemainingTime(value: string) {
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

function handleCancelAccount() {
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

function handleCreateBusinessCard() {
  showBusinessCard.value = true;
}

function handleOpenFeedback() {
  showFeedbackModal.value = true;
}

function handleOpenVipMembership() {
  void router.push({ name: 'ProfileVipMembership' });
}

function handleOpenTenantInvitations() {
  void router.push({ name: 'ProfileTenantInvitations' });
}

function handleOpenPrivacyPolicy() {
  openPrivacyPolicyDialog();
}

function handleOpenServiceAgreement() {
  openServiceAgreementDialog();
}

// function handleEditProfile() {
//   message.info('该功能正在开发中...');
// }

function handleChangePassword() {
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

const actions = computed(() => {
  const baseActions = [
    // {
    //   handler: handleEditProfile,
    //   icon: UserRoundPen,
    //   title: '修改个人信息',
    // },
    {
      handler: handleOpenVipMembership,
      icon: 'mdi:crown-outline',
      title: '会员服务',
    },
    ...(canManageTenantInvitations.value
      ? [
          {
            handler: handleOpenTenantInvitations,
            icon: 'mdi:ticket-confirmation-outline',
            title: '企业邀请码',
          },
        ]
      : []),
    {
      handler: handleChangePassword,
      icon: LockKeyhole,
      title: '修改密码',
    },
    {
      handler: handleCreateBusinessCard,
      icon: SvgCardIcon,
      title: '个人名片',
    },
    {
      handler: handleOpenFeedback,
      icon: 'mdi:message-text-outline',
      title: '意见反馈',
    },
    {
      handler: handleOpenPrivacyPolicy,
      icon: 'mdi:shield-account-outline',
      title: '\u9690\u79C1\u653F\u7B56',
    },
    {
      handler: handleOpenServiceAgreement,
      icon: 'mdi:file-document-outline',
      title: '\u670D\u52A1\u534F\u8BAE',
    },
    {
      danger: true,
      handler: handleCancelAccount,
      icon: 'mdi:account-remove-outline',
      title: '账号注销',
    },
    {
      handler: handleLogout,
      icon: LogOut,
      title: '退出登录',
    },
  ];

  if (isNative) {
    baseActions.splice(-1, 0, {
      handler: handleCheckUpdate,
      icon: RotateCw,
      title: '检查更新',
    });
  }

  return baseActions;
});
</script>

<template>
  <div class="p-3">
    <Card :bordered="false" class="mb-3">
      <div class="flex flex-col items-center justify-center py-4">
        <Avatar :size="64" :src="userInfo?.avatar" />
        <div class="mt-3 text-lg font-semibold">
          {{ userInfo?.realName }}
        </div>
      </div>
    </Card>

    <button
      v-if="trialStatusBar"
      class="trial-status-bar mb-3"
      :class="`trial-status-bar--${trialStatusBar.tone}`"
      type="button"
      @click="handleOpenVipMembership"
    >
      <span class="trial-status-bar__icon-wrap">
        <VbenIcon :icon="trialStatusBar.icon" class="trial-status-bar__icon" />
      </span>
      <span class="trial-status-bar__content">
        <span class="trial-status-bar__title">免费试用期</span>
        <span class="trial-status-bar__description">
          {{ trialStatusBar.description }}
        </span>
      </span>
      <Tag :color="trialStatusBar.tagColor" class="trial-status-bar__tag">
        {{ trialStatusBar.statusText }}
      </Tag>
      <VbenIcon :icon="ChevronRight" class="trial-status-bar__arrow" />
    </button>

    <Card :bordered="false">
      <List :data-source="actions">
        <template #renderItem="{ item }">
          <ListItem
            :class="{ 'danger-action': item.danger }"
            class="cursor-pointer"
            @click="item.handler"
          >
            <div class="flex w-full items-center justify-between">
              <div class="flex items-center">
                <VbenIcon :icon="item.icon" class="mr-2 size-4" />
                <span>{{ item.title }}</span>
              </div>
              <VbenIcon :icon="ChevronRight" class="size-4" />
            </div>
          </ListItem>
        </template>
      </List>
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
.trial-status-bar {
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

.trial-status-bar:hover {
  border-color: rgb(22 100 255 / 24%);
  box-shadow: 0 8px 22px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.trial-status-bar--active {
  background: linear-gradient(90deg, rgb(240 253 244 / 98%), #fff 52%);
  border-color: rgb(22 163 74 / 18%);
}

.trial-status-bar--expired {
  background: linear-gradient(90deg, rgb(255 251 235 / 98%), #fff 52%);
  border-color: rgb(217 119 6 / 20%);
}

.trial-status-bar--unknown {
  background: linear-gradient(90deg, rgb(239 246 255 / 98%), #fff 52%);
  border-color: rgb(14 165 233 / 16%);
}

.trial-status-bar__icon-wrap {
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

.trial-status-bar--active .trial-status-bar__icon-wrap {
  color: #16a34a;
  background: rgb(22 163 74 / 10%);
}

.trial-status-bar--expired .trial-status-bar__icon-wrap {
  color: #d97706;
  background: rgb(217 119 6 / 11%);
}

.trial-status-bar__icon {
  font-size: 21px;
}

.trial-status-bar__content {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.trial-status-bar__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.trial-status-bar__description {
  overflow: hidden;
  font-size: 13px;
  color: #667085;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trial-status-bar__tag {
  flex: 0 0 auto;
  margin-right: 0;
}

.trial-status-bar__arrow {
  flex: 0 0 auto;
  font-size: 16px;
  color: #98a2b3;
}

.danger-action {
  color: #ff4d4f;
}

@media (max-width: 420px) {
  .trial-status-bar {
    gap: 10px;
    padding: 10px 12px;
  }

  .trial-status-bar__description {
    white-space: normal;
  }

  .trial-status-bar__tag {
    display: none;
  }
}
</style>
