<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { isNativeRuntime } from '#/utils/native-runtime';

interface Props {
  disabled?: boolean;
  pullFactor?: number;
  pullingIcon?: string;
  pullingText?: string;
  pullMax?: number;
  pullMin?: number;
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
  refreshingText?: string;
  useNativeRefresher?: boolean;
}

interface Emits {
  (e: 'refresh', complete: () => void): void;
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  pullFactor: 1,
  pullingIcon: undefined,
  pullingText: '下拉刷新',
  pullMax: 180,
  pullMin: 60,
  refreshingSpinner: 'circular',
  refreshingText: '正在刷新...',
  useNativeRefresher: true,
});

const emit = defineEmits<Emits>();
const route = useRoute();
const ionContentRef = ref<null | {
  $el?: {
    scrollToTop?: (duration?: number) => Promise<void>;
  };
}>(null);
const scrollContainerRef = ref<HTMLElement>();

const NativePullToRefresh = defineAsyncComponent(
  () => import('./NativeIonicPullToRefresh.vue'),
);
const shouldUseNativeRefresher = computed(() => isNativeRuntime());

async function scrollContentToTop() {
  await nextTick();
  if (shouldUseNativeRefresher.value) {
    await ionContentRef.value?.$el?.scrollToTop?.(0);
    return;
  }
  scrollContainerRef.value?.scrollTo({ left: 0, top: 0 });
}

function handleRefresh(complete: () => void) {
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
  <NativePullToRefresh
    v-if="shouldUseNativeRefresher"
    ref="ionContentRef"
    :disabled="disabled"
    :pull-factor="pullFactor"
    :pulling-icon="pullingIcon"
    :pulling-text="pullingText"
    :pull-max="pullMax"
    :pull-min="pullMin"
    :refreshing-spinner="refreshingSpinner"
    :refreshing-text="refreshingText"
    :use-native-refresher="useNativeRefresher"
    @refresh="handleRefresh"
  >
    <slot></slot>
  </NativePullToRefresh>
  <div v-else ref="scrollContainerRef" class="pull-content">
    <slot></slot>
  </div>
</template>

<style scoped>
.pull-content {
  width: 100%;
  height: 100%;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
