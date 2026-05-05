<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import BaseChart from './BaseChart.vue';
import { getRevenueChartConfig } from './chartConfigs';

// 响应式屏幕尺寸
const screenWidth = ref(window.innerWidth);
const isMobile = computed(() => screenWidth.value < 768);
const isTablet = computed(
  () => screenWidth.value >= 768 && screenWidth.value < 1024,
);

// 监听窗口大小变化
const handleResize = () => {
  screenWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 响应式字体大小
const labelFontSize = computed(() => {
  if (isMobile.value) return 'text-[10px]';
  if (isTablet.value) return 'text-xs';
  return 'text-sm';
});

const valueFontSize = computed(() => {
  if (isMobile.value) return 'text-xs';
  if (isTablet.value) return 'text-sm';
  return 'text-base';
});

const dotSize = computed(() => {
  if (isMobile.value) return 'w-2 h-2';
  return 'w-2.5 h-2.5';
});

const selectedLocation = ref('all');
const locations = [
  { label: '全部', value: 'all' },
  { label: '园区A', value: 'factory1' },
  { label: '园区B', value: 'factory2' },
  { label: '园区C', value: 'factory3' },
];

const mockData = {
  actual: [
    1_100_000, 950_000, 880_000, 1_200_000, 1_350_000, 1_420_000, 1_580_000,
    1_650_000, 1_520_000, 1_480_000, 1_720_000, 1_850_000,
  ],
  months: [
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
  ],
  pending: [
    140_000, 130_000, 120_000, 150_000, 180_000, 240_000, 240_000, 230_000,
    210_000, 200_000, 240_000, 260_000,
  ],
  received: [
    960_000, 820_000, 760_000, 1_050_000, 1_170_000, 1_180_000, 1_310_000,
    1_420_000, 1_310_000, 1_280_000, 1_480_000, 1_590_000,
  ],
};
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 grid flex-initial grid-cols-3 gap-2">
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div class="rounded-full bg-green-500" :class="[dotSize]"></div>
          <span class="text-gray-500" :class="[labelFontSize]">实收总额</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          2364340.16元
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          2026年度
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div class="rounded-full bg-blue-500" :class="[dotSize]"></div>
          <span class="text-gray-500" :class="[labelFontSize]">已收总额</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          1485001.04元
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          2026年度
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div class="rounded-full bg-orange-500" :class="[dotSize]"></div>
          <span class="text-gray-500" :class="[labelFontSize]">待收总额</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          879339.12元
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          2026年度
        </div>
      </div>
    </div>
    <div class="mb-2">
      <select
        v-model="selectedLocation"
        class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
      >
        <option v-for="loc in locations" :key="loc.value" :value="loc.value">
          {{ loc.label }}
        </option>
      </select>
    </div>
    <div class="min-h-0 flex-1">
      <BaseChart
        :chart-config-fn="(data: any) => getRevenueChartConfig(data, isMobile)"
        :chart-data="mockData"
      />
    </div>
  </div>
</template>
