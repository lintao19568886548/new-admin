<script lang="ts" setup>
import { computed, defineAsyncComponent } from 'vue';

import { useWindowSize } from '@vueuse/core';

const DesktopList = defineAsyncComponent(() => import('./list.vue'));
const MobileList = defineAsyncComponent(() => import('./mobile-list.vue'));

const { width } = useWindowSize();
const isMobile = computed(() => width.value < 768);
</script>

<template>
  <MobileList v-if="isMobile" />
  <DesktopList v-else />
</template>
