<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { getParkDashboardStats } from '#/api/park/park';

import BaseChart from './BaseChart.vue';
import { getSemiPieChartConfig } from './chartConfigs';

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

const valueFontSize = computed(() => {
  if (isMobile.value) return 'text-xs';
  if (isTablet.value) return 'text-sm';
  return 'text-base';
});

const chartHeight = computed(() => {
  if (isMobile.value) return 'min-h-[120px]';
  if (isTablet.value) return 'min-h-[140px]';
  return 'min-h-[160px]';
});

// 租赁统计数据
const rentalStats = ref({
  rentalRate: '82.10',
  rentedArea: '36657.00',
  rentedCount: 175,
  totalArea: '44660.00',
  vacantArea: '8003.00',
  vacantCount: 11,
});

// 获取统计数据
const fetchRentalStats = async () => {
  try {
    const res: any = await getParkDashboardStats();
    if (res) {
      rentalStats.value = {
        rentalRate: res.rentalRate || '0.00',
        rentedArea: res.rentedArea || '0.00',
        rentedCount: res.rentedCount || 0,
        totalArea: res.totalArea || '0.00',
        vacantArea: res.vacantArea || '0.00',
        vacantCount: res.vacantCount || 0,
      };
    }
  } catch (error) {
    console.error('获取园区租赁统计数据失败:', error);
  }
};

onMounted(() => {
  fetchRentalStats();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 grid flex-initial grid-cols-2 gap-2 md:grid-cols-4">
      <div class="rounded-lg bg-gray-50 p-2 md:p-2.5">
        <div class="mb-1 text-gray-500" :class="[titleFontSize]">总面积</div>
        <div
          class="whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ rentalStats.totalArea }} 平方米
        </div>
        <div class="mt-1 text-gray-400" :class="[titleFontSize]">
          数量: {{ rentalStats.rentedCount + rentalStats.vacantCount }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 md:p-2.5">
        <div class="mb-1 text-gray-500" :class="[titleFontSize]">已租面积</div>
        <div
          class="whitespace-nowrap font-bold text-blue-500"
          :class="[valueFontSize]"
        >
          {{ rentalStats.rentedArea }} 平方米
        </div>
        <div class="mt-1 text-gray-400" :class="[titleFontSize]">
          数量: {{ rentalStats.rentedCount }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 md:p-2.5">
        <div class="mb-1 text-gray-500" :class="[titleFontSize]">空置面积</div>
        <div
          class="whitespace-nowrap font-bold text-green-500"
          :class="[valueFontSize]"
        >
          {{ rentalStats.vacantArea }} 平方米
        </div>
        <div class="mt-1 text-gray-400" :class="[titleFontSize]">
          数量: {{ rentalStats.vacantCount }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 md:p-2.5">
        <div class="mb-1 text-gray-500" :class="[titleFontSize]">出租率</div>
        <div
          class="whitespace-nowrap font-bold text-orange-500"
          :class="[valueFontSize]"
        >
          {{ rentalStats.rentalRate }}%
        </div>
      </div>
    </div>
    <div class="grid min-h-0 flex-1 grid-cols-2 gap-2">
      <div
        class="flex flex-col rounded-lg bg-gray-50 p-2 md:p-4"
        :class="[chartHeight]"
      >
        <div
          class="mb-2 font-medium text-gray-600 md:mb-3"
          :class="[titleFontSize]"
        >
          按面积
        </div>
        <div class="min-h-0 flex-1">
          <BaseChart
            :chart-config-fn="
              (data: any) => getSemiPieChartConfig(data, screenWidth)
            "
            :chart-data="[
              { name: '已租', value: Number(rentalStats.rentedArea) },
              { name: '未租', value: Number(rentalStats.vacantArea) },
            ]"
          />
        </div>
      </div>
      <div
        class="flex flex-col rounded-lg bg-gray-50 p-2 md:p-4"
        :class="[chartHeight]"
      >
        <div
          class="mb-2 font-medium text-gray-600 md:mb-3"
          :class="[titleFontSize]"
        >
          按数量
        </div>
        <div class="min-h-0 flex-1">
          <BaseChart
            :chart-config-fn="
              (data: any) => getSemiPieChartConfig(data, screenWidth)
            "
            :chart-data="[
              { name: '已租', value: rentalStats.rentedCount },
              { name: '未租', value: rentalStats.vacantCount },
            ]"
          />
        </div>
      </div>
    </div>
  </div>
</template>
