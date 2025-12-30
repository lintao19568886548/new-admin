import type { Component } from 'vue';

import { ref } from 'vue';

import { defineStore } from 'pinia';

interface HeaderAction {
  /**
   * 按钮上显示的图标，可选。
   * @example 'mdi:history'
   */
  icon?: Component | string;
  /**
   * 动作的唯一标识符。
   */
  key: string;
  onClick: () => void;
  /**
   * 按钮上显示的文本，可选。
   * 如果提供了文本，将渲染一个按钮；否则，如果只提供了图标，将渲染一个图标按钮。
   */
  text?: string;
}

/**
 * 管理应用布局，特别是移动端头部操作。
 *
 * @example
 * ```vue
 * <script setup>
 * import { onMounted, onUnmounted } from 'vue';
 * import { useRouter } from 'vue-router';
 * import { useLayoutStore } from '#/store/layout';
 *
 * const router = useRouter();
 * const layoutStore = useLayoutStore();
 *
 * onMounted(() => {
 *   layoutStore.setHeaderActions([
 *     {
 *       key: 'add',
 *       text: '新增',
 *       onClick: () => console.log('add'),
 *     },
 *     {
 *       key: 'history',
 *       icon: 'mdi:history',
 *       onClick: () => router.push('/history'),
 *     },
 *   ]);
 * });
 *
 * onUnmounted(() => {
 *   layoutStore.clearHeaderActions();
 * });
 * </script>
 * ```
 */
export const useLayoutStore = defineStore('app-layout', () => {
  const headerActions = ref<HeaderAction[]>([]);
  const onRefresh = ref<(() => Promise<void> | void) | null>(null);

  // 记录初始状态
  const initialState = {
    headerActions: [],
  };

  /**
   * 设置头部动作按钮。这将替换任何现有的动作。
   * @param actions - 要在头部显示的动作数组。
   */
  function setHeaderActions(actions: HeaderAction[]) {
    headerActions.value = actions;
  }

  /**
   * 清除所有头部动作按钮。
   */
  function clearHeaderActions() {
    headerActions.value = [];
  }

  function setOnRefresh(handler: (() => Promise<void> | void) | null) {
    onRefresh.value = handler;
  }

  // 重置 Store
  function $reset() {
    headerActions.value = initialState.headerActions;
    onRefresh.value = null;
  }

  return {
    $reset,
    clearHeaderActions,
    headerActions,
    onRefresh,
    setHeaderActions,
    setOnRefresh,
  };
});
