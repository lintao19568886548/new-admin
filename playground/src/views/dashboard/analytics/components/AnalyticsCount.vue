<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import BaseChart from './BaseChart.vue';
import {
  getDailyElectricityTrendChartConfig,
  getElectricityPieChartConfig,
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
const titleFontSize = computed(() => {
  if (isMobile.value) return 'text-[10px]';
  if (isTablet.value) return 'text-xs';
  return 'text-sm';
});

const sectionTitleFontSize = computed(() => {
  if (isMobile.value) return 'text-xs';
  if (isTablet.value) return 'text-sm';
  return 'text-base';
});

const selectedLocation = ref('all');
const locations = [
  { label: '全部', value: 'all' },
  { label: '园区A', value: 'factory1' },
  { label: '园区B', value: 'factory2' },
  { label: '园区C', value: 'factory3' },
];

// 尖峰平谷用电量数据（扇形图）
// 每天8次切换：尖→峰→平→谷→尖→峰→平→谷
const peakValleyData = [
  { itemStyle: { color: '#EF4444' }, name: '尖', value: 1250 },
  { itemStyle: { color: '#F97316' }, name: '峰', value: 2100 },
  { itemStyle: { color: '#3B82F6' }, name: '平', value: 1800 },
  { itemStyle: { color: '#10B981' }, name: '谷', value: 950 },
];

// 每日用电变化数据（折线图）
const dailyTrendData = {
  periods: ['谷', '谷', '峰', '尖', '峰', '平', '峰', '谷'],
  times: [
    '00:00-03:00',
    '03:00-06:00',
    '06:00-09:00',
    '09:00-12:00',
    '12:00-15:00',
    '15:00-18:00',
    '18:00-21:00',
    '21:00-24:00',
  ],
  values: [320, 280, 720, 850, 700, 580, 680, 350],
};
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 flex flex-initial items-center justify-between">
      <div class="font-medium text-gray-600" :class="[sectionTitleFontSize]">
        用电统计
      </div>
      <select
        v-model="selectedLocation"
        class="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs outline-none focus:border-blue-500"
      >
        <option v-for="loc in locations" :key="loc.value" :value="loc.value">
          {{ loc.label }}
        </option>
      </select>
    </div>
    <div class="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
      <div class="flex flex-col rounded-lg bg-gray-50 p-2">
        <div class="mb-1 text-center text-gray-500" :class="[titleFontSize]">
          尖峰平谷用电分布
        </div>
        <div class="flex-1">
          <BaseChart
            :chart-config-fn="
              (data: any) => getElectricityPieChartConfig(data, screenWidth)
            "
            :chart-data="peakValleyData"
          />
        </div>
      </div>
      <div class="flex flex-col rounded-lg bg-gray-50 p-2">
        <div class="mb-1 text-center text-gray-500" :class="[titleFontSize]">
          每日用电变化
        </div>
        <div class="flex-1">
          <BaseChart
            :chart-config-fn="
              (data: any) => getDailyElectricityTrendChartConfig(data, isMobile)
            "
            :chart-data="dailyTrendData"
          />
        </div>
      </div>
    </div>
  </div>
</template>
