<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import BaseChart from './BaseChart.vue';
import {
  getCustomerTrendChartConfig,
  getNegotiationProgressChartConfig,
} from './chartConfigs';

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

const iconSize = computed(() => {
  if (isMobile.value) return 'w-5 h-5';
  return 'w-6 h-6';
});

const innerIconSize = computed(() => {
  if (isMobile.value) return 'w-1.5 h-1.5';
  return 'w-2 h-2';
});

// 客户趋势数据（折线图）
const customerTrendData = {
  activeCustomers: [185, 192, 205, 210, 215, 220, 228, 235, 242, 250, 258, 265],
  dates: [
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
  lostCustomers: [5, 4, 6, 3, 5, 4, 5, 3, 4, 5, 3, 4],
  negotiatingCustomers: [
    98, 102, 108, 112, 115, 118, 122, 125, 128, 132, 135, 140,
  ],
  newCustomers: [28, 32, 35, 38, 40, 42, 45, 48, 52, 55, 58, 62],
  totalCustomers: [380, 405, 420, 435, 448, 462, 475, 488, 502, 515, 528, 545],
};

// 洽谈进度数据（饼状图）
const negotiationProgressData = [
  { name: '初步接洽', value: 35 },
  { name: '深入沟通', value: 28 },
  { name: '合同准备', value: 22 },
  { name: '签约完成', value: 15 },
];
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 grid flex-initial grid-cols-5 gap-2">
      <div class="rounded-lg bg-gray-50 p-2 text-center">
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-purple-100"
          :class="[iconSize]"
        >
          <div
            class="rounded-full bg-purple-500"
            :class="[innerIconSize]"
          ></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">465</div>
        <div class="text-gray-400" :class="[labelFontSize]">总客户数</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 text-center">
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-blue-100"
          :class="[iconSize]"
        >
          <div class="rounded-full bg-blue-500" :class="[innerIconSize]"></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">220</div>
        <div class="text-gray-400" :class="[labelFontSize]">意向客户</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 text-center">
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-green-100"
          :class="[iconSize]"
        >
          <div class="rounded-full bg-green-500" :class="[innerIconSize]"></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">45</div>
        <div class="text-gray-400" :class="[labelFontSize]">本月新增</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 text-center">
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-orange-100"
          :class="[iconSize]"
        >
          <div
            class="rounded-full bg-orange-500"
            :class="[innerIconSize]"
          ></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">100</div>
        <div class="text-gray-400" :class="[labelFontSize]">洽谈中</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 text-center">
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-red-100"
          :class="[iconSize]"
        >
          <div class="rounded-full bg-red-500" :class="[innerIconSize]"></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">3</div>
        <div class="text-gray-400" :class="[labelFontSize]">本月流失</div>
      </div>
    </div>
    <div class="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
      <div class="flex flex-col rounded-lg bg-gray-50 p-2 md:p-3">
        <div
          class="mb-2 flex-initial font-medium text-gray-600"
          :class="[labelFontSize]"
        >
          客户趋势
        </div>
        <div class="min-h-0 flex-1">
          <BaseChart
            :chart-config-fn="
              (data: any) => getCustomerTrendChartConfig(data, isMobile)
            "
            :chart-data="customerTrendData"
          />
        </div>
      </div>
      <div class="flex flex-col rounded-lg bg-gray-50 p-2 md:p-3">
        <div
          class="mb-2 flex-initial font-medium text-gray-600"
          :class="[labelFontSize]"
        >
          洽谈进度
        </div>
        <div class="min-h-0 flex-1">
          <BaseChart
            :chart-config-fn="
              (data: any) =>
                getNegotiationProgressChartConfig(data, screenWidth)
            "
            :chart-data="negotiationProgressData"
          />
        </div>
      </div>
    </div>
  </div>
</template>
