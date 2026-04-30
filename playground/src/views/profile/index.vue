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
import { Avatar, Card, List, ListItem, message, Modal } from 'ant-design-vue';

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
.danger-action {
  color: #ff4d4f;
}
</style>
