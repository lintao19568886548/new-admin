<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { LockKeyhole } from '@vben/icons';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { $t } from '@vben/locales';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';
import EditPassword from '#/views/_core/authentication/edit-password.vue';
import LoginForm from '#/views/_core/authentication/login.vue';

// const notifications = ref<NotificationItem[]>([
//   {
//     avatar: 'https://avatar.vercel.sh/vercel.svg?text=VB',
//     date: '3小时前',
//     isRead: true,
//     message: '描述信息描述信息描述信息',
//     title: '收到了 14 份新周报',
//   },
//   {
//     avatar: 'https://avatar.vercel.sh/1',
//     date: '刚刚',
//     isRead: false,
//     message: '描述信息描述信息描述信息',
//     title: '朱偏右 回复了你',
//   },
//   {
//     avatar: 'https://avatar.vercel.sh/1',
//     date: '2024-01-01',
//     isRead: false,
//     message: '描述信息描述信息描述信息',
//     title: '曲丽丽 评论了你',
//   },
//   {
//     avatar: 'https://avatar.vercel.sh/satori',
//     date: '1天前',
//     isRead: false,
//     message: '描述信息描述信息描述信息',
//     title: '代办提醒',
//   },
// ]);

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
// const showDot = computed(() =>
//   notifications.value.some((item) => !item.isRead),
// );

// 添加修改密码模态框的状态
const showPasswordModal = ref(false);

const menus = computed(() => [
  {
    handler: () => {
      showPasswordModal.value = true;
    },
    icon: LockKeyhole,
    text: '修改密码',
  },
  // {
  //   handler: () => {
  //     openWindow(VBEN_DOC_URL, {
  //       target: '_blank',
  //     });
  //   },
  //   icon: BookOpenText,
  //   text: $t('ui.widgets.document'),
  // },
  // {
  //   handler: () => {
  //     openWindow(VBEN_GITHUB_URL, {
  //       target: '_blank',
  //     });
  //   },
  //   icon: MdiGithub,
  //   text: 'GitHub',
  // },
  // {
  //   handler: () => {
  //     openWindow(`${VBEN_GITHUB_URL}/issues`, {
  //       target: '_blank',
  //     });
  //   },
  //   icon: CircleHelp,
  //   text: $t('ui.widgets.qa'),
  // },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

// function handleNoticeClear() {
//   notifications.value = [];
// }

// function handleMakeAll() {
//   notifications.value.forEach((item) => (item.isRead = true));
// }

// 处理密码修改成功
function handlePasswordChanged() {
  // 可以在这里添加额外的逻辑，比如刷新用户信息等

  message.success($t('page.auth.passwordChangeSuccess'));
}

watch(
  () => preferences.app.watermark,
  async (enable) => {
    if (enable) {
      await updateWatermark({
        content: `${userStore.userInfo?.username}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        trigger="both"
        @logout="handleLogout"
      />
    </template>
    <!-- <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @make-all="handleMakeAll"
      />
    </template> -->
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>

      <!-- 添加修改密码模态框 -->
      <EditPassword
        v-model:open="showPasswordModal"
        @success="handlePasswordChanged"
      />
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
