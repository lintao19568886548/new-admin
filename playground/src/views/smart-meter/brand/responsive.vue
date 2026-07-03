<script lang="ts" setup>
import type { MeterType } from '#/api/smart-meter';

import { computed, defineAsyncComponent } from 'vue';

import { useWindowSize } from '@vueuse/core';

const props = withDefaults(
  defineProps<{
    meterType?: MeterType;
  }>(),
  {
    meterType: 'electric',
  },
);

const DesktopList = defineAsyncComponent(() => import('./list.vue'));
const MobileList = defineAsyncComponent(() => import('./mobile.vue'));

const { width } = useWindowSize();
const isMobile = computed(() => width.value < 768);
</script>

<template>
  <MobileList v-if="isMobile" :meter-type="props.meterType" />
  <DesktopList v-else :meter-type="props.meterType" />
</template>
