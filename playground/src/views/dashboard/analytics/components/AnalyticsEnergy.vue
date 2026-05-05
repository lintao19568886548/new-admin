<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';

import BaseChart from './BaseChart.vue';
import { getEnergyConsumptionChartConfig } from './chartConfigs';

const screenWidth = ref(window.innerWidth);
const isMobile = computed(() => screenWidth.value < 768);
const isTablet = computed(
  () => screenWidth.value >= 768 && screenWidth.value < 1024,
);

const handleResize = () => {
  screenWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const labelFontSize = computed(() => {
  if (isMobile.value) return 'text-[10px]';
  if (isTablet.value) return 'text-xs';
  return 'text-sm';
});

const selectedLocation = ref('all');
const locations = [
  { label: '全部', value: 'all' },
  { label: '园区A', value: 'factory1' },
  { label: '园区B', value: 'factory2' },
  { label: '园区C', value: 'factory3' },
];

const mockData = {
  electricity: [
    12_500, 11_800, 13_200, 14_500, 13_800, 12_900, 14_100, 15_200, 14_800,
    13_500, 14_200, 15_500,
  ],
  monthOnMonth: [
    5.2, -3.8, 2.5, 8.3, -2.1, -4.5, 3.2, 6.8, -1.5, -3.1, 4.2, 6.1,
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
  water: [
    4200, 3800, 4500, 5100, 4800, 4400, 4900, 5400, 5100, 4700, 4900, 5500,
  ],
  yearOnYear: [
    8.5, 7.2, 9.1, 10.5, 9.8, 8.9, 10.2, 11.3, 10.7, 9.5, 10.1, 11.8,
  ],
};
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 flex flex-initial items-center justify-between">
      <div class="font-medium text-gray-600" :class="[labelFontSize]">
        水电消耗
      </div>
      <select
        v-model="selectedLocation"
        class="rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
      >
        <option v-for="loc in locations" :key="loc.value" :value="loc.value">
          {{ loc.label }}
        </option>
      </select>
    </div>
    <div class="min-h-0 flex-1">
      <BaseChart
        :chart-config-fn="
          (data: any) => getEnergyConsumptionChartConfig(data, isMobile)
        "
        :chart-data="mockData"
      />
    </div>
  </div>
</template>
