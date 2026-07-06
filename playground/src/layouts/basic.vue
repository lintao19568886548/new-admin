<script lang="ts" setup>
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal, VbenIcon } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { ArrowLeft, IconDefault, LockKeyhole, UserRoundPen } from '@vben/icons';
import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { $t } from '@vben/locales';
import { preferences, updatePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import IonicPullToRefresh from '#/components/IonicPullToRefresh.vue';
import { usePullToRefresh } from '#/hooks/usePullToRefresh';
import { useWorkbenchTodoPush } from '#/hooks/useWorkbenchTodoPush';
import { useAuthStore } from '#/store';
import { useLayoutStore } from '#/store/layout';
import { isNativeRuntime } from '#/utils/native-runtime';
import EditPassword from '#/views/_core/authentication/edit-password.vue';
import LoginForm from '#/views/_core/authentication/login.vue';

const FALLBACK_NOT_FOUND_NAME = 'FallbackNotFound';
const MOBILE_MAIN_TAB_PATHS = new Set(['/home', '/profile', '/workbench']);
const AutoUpdateChecker = defineAsyncComponent(
  () => import('#/components/auto-update-checker.vue'),
);
const isMobile = ref(false);
let backButtonListener: null | { remove: () => Promise<void> } = null;

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(async () => {
  handleResize();
  window.addEventListener('resize', handleResize);

  // 处理硬件返回按钮
  if (isNativeRuntime()) {
    const { App } = await import('@capacitor/app');
    backButtonListener = await App.addListener(
      'backButton',
      ({ canGoBack }) => {
        if (router.currentRoute.value.name === FALLBACK_NOT_FOUND_NAME) {
          void router.replace('/workbench');
          return;
        }

        if (canGoBack) {
          router.back();
        } else {
          // 在首页时，最小化应用而不是退出
          App.minimizeApp();
        }
      },
    );
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  stopWorkbenchTodoPush();

  void backButtonListener?.remove();
});

const router = useRouter();
const { startWorkbenchTodoPush, stopWorkbenchTodoPush } =
  useWorkbenchTodoPush(router);
const layoutStore = useLayoutStore();

const showBackButton = computed(
  () => !MOBILE_MAIN_TAB_PATHS.has(router.currentRoute.value.path),
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

// 下拉刷新功能
const { handleRefresh } = usePullToRefresh({
  enabled: true,
  onRefresh: async () => {
    // 自定义刷新逻辑
    // 这里可以根据当前路由执行不同的刷新操作
    const currentRoute = router.currentRoute.value;

    // 可以在这里添加具体的数据刷新逻辑
    // 比如重新获取用户信息、刷新页面数据等
    console.warn('刷新页面:', currentRoute.path);
    window.location.reload();
  },
  showSuccessMessage: true,
  successMessage: '页面已刷新',
});

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

const shouldRenderAutoUpdateChecker = computed(
  () => isNativeRuntime() && !!accessStore.accessToken,
);

watch(
  () => accessStore.accessToken,
  (accessToken) => {
    if (accessToken) {
      startWorkbenchTodoPush({ immediate: true });
      return;
    }

    stopWorkbenchTodoPush();
  },
  { immediate: true },
);

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
const isImmersiveRoute = computed(
  () => router.currentRoute.value.meta.hideInTab,
);

const tabs = [
  { icon: IconDefault, path: '/home', title: '首页' },
  { icon: 'lucide:layout-grid', path: '/workbench', title: '智能管理' },
  // { icon: SwatchBook, path: '/analytics', title: '列表' },
  { icon: UserRoundPen, path: '/profile', title: '我的' },
];

function goTo(path: string) {
  void router.push(path);
}

function goBack() {
  if (router.currentRoute.value.name === FALLBACK_NOT_FOUND_NAME) {
    void router.replace('/workbench');
    return;
  }

  // 检查是否有历史记录
  if (window.history.length > 1) {
    router.back();
  } else {
    router.replace('/workbench');
  }
}
</script>

<template>
  <!-- Mobile Layout -->
  <div v-if="isMobile" class="app-layout">
    <!-- App Top Navigation Bar -->
    <header v-if="!isImmersiveRoute" class="app-header">
      <div class="app-header-toolbar">
        <div class="bg-white dark:bg-gray-900">
          <div
            class="pl-[calc(12px+env(safe-area-inset-left))] pr-[calc(12px+env(safe-area-inset-right))] pt-[env(safe-area-inset-top)]"
          >
            <div class="flex h-12 items-center justify-between">
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
              <div
                class="flex min-w-10 items-center justify-end space-x-2 text-right"
              >
                <template
                  v-for="action in layoutStore.headerActions"
                  :key="action.key"
                >
                  <Button
                    v-if="action.text"
                    type="primary"
                    size="small"
                    @click="action.onClick"
                  >
                    <template #icon v-if="action.icon">
                      <VbenIcon :icon="action.icon" class="size-4" />
                    </template>
                    {{ action.text }}
                  </Button>
                  <VbenIcon
                    v-else-if="action.icon"
                    :icon="action.icon"
                    class="size-6 cursor-pointer"
                    @click="action.onClick"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="app-main">
      <IonicPullToRefresh @refresh="handleRefresh">
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
      </IonicPullToRefresh>
    </main>

    <!-- App Bottom Tab Bar -->
    <footer v-if="!isImmersiveRoute" class="app-footer">
      <div class="app-footer-toolbar">
        <div
          class="bg-white pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] dark:bg-gray-900"
        >
          <div class="flex h-[52px] items-center justify-around">
            <div
              v-for="tab in tabs"
              :key="tab.path"
              :class="{ 'app-tab-item--active': activeTab === tab.path }"
              class="app-tab-item"
              @click="goTo(tab.path)"
            >
              <VbenIcon :icon="tab.icon" class="app-tab-icon mb-1" />
              {{ tab.title }}
            </div>
          </div>
        </div>
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

  <!-- 自动更新检查组件（无UI，仅功能） -->
  <AutoUpdateChecker v-if="shouldRenderAutoUpdateChecker" />
</template>

<style lang="css" scoped>
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

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100dvh;
}

.app-header-toolbar {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.app-main {
  position: relative;
  flex-grow: 1;
  min-height: 0;
  overflow: hidden; /* 让PullToRefresh组件管理滚动 */
}

/* 下拉刷新组件内部的滚动样式 */
.app-main :deep(.pull-content) {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.app-main :deep(.pull-content::-webkit-scrollbar) {
  display: none; /* Chrome, Safari, and Opera */
}

.app-footer-toolbar {
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
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

.app-tab-icon {
  font-size: 20px;
  line-height: 1;
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
</style>
