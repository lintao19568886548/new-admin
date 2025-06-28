<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal, VbenIcon } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { ArrowLeft, IconDefault, LockKeyhole, UserRoundPen } from '@vben/icons';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { $t } from '@vben/locales';
import { preferences, updatePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';
import EditPassword from '#/views/_core/authentication/edit-password.vue';
import LoginForm from '#/views/_core/authentication/login.vue';

const isMobile = ref(false);

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);

  // 处理硬件返回按钮
  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', ({ canGoBack }: any) => {
      if (canGoBack) {
        router.back();
      } else {
        // 在首页时，最小化应用而不是退出
        App.minimizeApp();
      }
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);

  // 清理 Capacitor 监听器
  if (Capacitor.isNativePlatform()) {
    App.removeAllListeners();
  }
});

const router = useRouter();

const showBackButton = computed(
  () => router.currentRoute.value.path !== '/home',
);

// By setting these preferences, we can disable the original layout components
// and use BasicLayout as a content container.
watch(
  isMobile,
  (mobile) => {
    if (mobile) {
      updatePreferences({
        app: {
          enablePreferences: false,
        },
        footer: { enable: false }, // Disable original footer
        header: { enable: false }, // Disable original header
        sidebar: { enable: false }, // Disable sidebar for an app-like view
        tabbar: { enable: false }, // Disable web-style tabs
        theme: {
          mode: 'light',
        },
      });
    } else {
      // Restore desktop preferences
      updatePreferences({
        app: {
          enablePreferences: true,
        },
        footer: { enable: false },
        header: { enable: true },
        sidebar: { enable: true },
        tabbar: { enable: true },
        theme: {
          mode: 'light',
        },
      });
    }
  },
  { immediate: true },
);

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
  await authStore.logout();
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

const activeTab = computed(() => router.currentRoute.value.path);

const tabs = [
  { icon: IconDefault, path: '/home', title: '首页' },
  // { icon: SwatchBook, path: '/analytics', title: '列表' },
  { icon: UserRoundPen, path: '/profile', title: '我的' },
];

function goTo(path: string) {
  router.push(path);
}

function goBack() {
  // 检查是否有历史记录
  if (window.history.length > 1) {
    router.back();
  } else {
    // 没有历史记录时，导航到首页而不是退出应用
    router.push('/home');
  }
}
</script>

<template>
  <!-- Mobile Layout -->
  <div v-if="isMobile" class="app-layout">
    <!-- App Top Navigation Bar -->
    <header class="app-header">
      <div class="w-10">
        <VbenIcon
          v-if="showBackButton"
          :icon="ArrowLeft"
          class="cursor-pointer"
          @click="goBack"
        />
      </div>
      <div class="font-bold">
        {{ $t(router.currentRoute.value.meta.title || '标题') }}
      </div>
      <div class="w-10 text-right">
        <!-- Right Icon -->
        <VbenIcon
          v-if="router.currentRoute.value.path === '/hrm/attendance/check-in'"
          icon="mdi:history"
          class="size-6"
          @click="
            router.push({
              path: '/hrm/attendance/record',
            })
          "
        />
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="app-main">
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
    </main>

    <!-- App Bottom Tab Bar -->
    <footer class="app-footer">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        :class="{ 'app-tab-item--active': activeTab === tab.path }"
        class="app-tab-item"
        @click="goTo(tab.path)"
      >
        <VbenIcon :icon="tab.icon" class="mb-1" />
        {{ tab.title }}
      </div>
    </footer>
  </div>
  <!-- Desktop Layout -->
  <BasicLayout v-else @clear-preferences-and-logout="handleLogout">
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

<style lang="css" scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.app-main {
  flex-grow: 1;
  overflow-y: auto; /* Allow scrolling */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.app-main::-webkit-scrollbar {
  display: none; /* Chrome, Safari, and Opera */
}

.app-footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-around;
  height: 52px;
  background-color: #fff;
  border-top: 1px solid #f0f0f0;
}

.app-tab-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}

.app-tab-item:hover {
  color: #1e293b;
  transform: translateY(-2px);
}

.app-tab-item--active {
  font-weight: 600;
  color: var(--primary-color);
  animation: pulse-animation 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes pulse-animation {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
  }
}
</style>
