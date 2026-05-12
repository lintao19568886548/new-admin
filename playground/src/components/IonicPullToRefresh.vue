<script setup lang="ts">
import type { RefresherCustomEvent } from '@ionic/vue';

import { nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/vue';

/**
 * 下拉刷新组件的属性接口
 * 注意：使用原生刷新器时，某些属性（如 pullFactor、pullMin、pullMax）不兼容
 */
interface Props {
  /** 是否禁用下拉刷新 */
  disabled?: boolean;
  /** 拉动因子，控制拉动的速度（仅在非原生模式下有效） */
  pullFactor?: number;
  /** 拉动时显示的图标（设置此项会禁用原生刷新器） */
  pullingIcon?: string;
  /** 拉动时显示的文本 */
  pullingText?: string;
  /** 最大拉动距离（仅在非原生模式下有效） */
  pullMax?: number;
  /** 最小拉动距离（仅在非原生模式下有效） */
  pullMin?: number;
  /** 刷新时的加载器类型（原生 MD 模式使用 circular） */
  refreshingSpinner?:
    | 'bubbles'
    | 'circles'
    | 'circular'
    | 'crescent'
    | 'dots'
    | 'lines'
    | 'lines-sharp'
    | 'lines-sharp-small'
    | 'lines-small';
  /** 刷新时显示的文本 */
  refreshingText?: string;
  /** 是否使用原生刷新器（默认启用） */
  useNativeRefresher?: boolean;
}

/**
 * 组件事件接口
 */
interface Emits {
  /** 触发刷新事件，传递完成回调函数 */
  (e: 'refresh', complete: () => void): void;
}

// 定义组件属性，设置默认值
withDefaults(defineProps<Props>(), {
  disabled: false,
  pullFactor: 1,
  pullingIcon: undefined, // 不设置图标以启用原生刷新器
  pullingText: '下拉刷新',
  pullMax: 180,
  pullMin: 60,
  refreshingSpinner: 'circular', // MD 原生刷新器使用 circular
  refreshingText: '正在刷新...',
  useNativeRefresher: true, // 默认使用原生刷新器
});

// 定义组件事件
const emit = defineEmits<Emits>();
const route = useRoute();
const ionContentRef = ref<null | {
  $el?: {
    scrollToTop?: (duration?: number) => Promise<void>;
  };
}>(null);

async function scrollContentToTop() {
  await nextTick();
  await ionContentRef.value?.$el?.scrollToTop?.(0);
}

/**
 * 处理下拉刷新事件
 * @param event - Ionic 刷新事件对象
 */
function handleRefresh(event: RefresherCustomEvent) {
  // 创建完成回调函数
  const complete = () => {
    event.target.complete();
  };

  // 触发父组件的刷新事件
  emit('refresh', complete);
}

watch(
  () => route.fullPath,
  () => {
    void scrollContentToTop();
  },
);
</script>

<template>
  <IonContent ref="ionContentRef" class="ion-padding">
    <!-- eslint-disable vue/no-deprecated-slot-attribute -->
    <IonRefresher
      slot="fixed"
      :disabled="disabled"
      :pull-factor="useNativeRefresher ? undefined : pullFactor"
      :pull-min="useNativeRefresher ? undefined : pullMin"
      :pull-max="useNativeRefresher ? undefined : pullMax"
      @ion-refresh="handleRefresh($event)"
    >
      <IonRefresherContent
        :pulling-icon="useNativeRefresher ? undefined : pullingIcon"
        :pulling-text="pullingText"
        :refreshing-spinner="refreshingSpinner"
        :refreshing-text="refreshingText"
      />
    </IonRefresher>
    <!-- eslint-enable vue/no-deprecated-slot-attribute -->

    <!-- 内容插槽 -->
    <slot></slot>
  </IonContent>
</template>
