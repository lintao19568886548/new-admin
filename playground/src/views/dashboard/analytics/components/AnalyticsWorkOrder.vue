<script lang="ts" setup>
import type { PropType } from 'vue';

import type { EchartsUIType } from '@vben/plugins/echarts';

import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getWorkOrderChartConfig } from './chartConfigs';

const DashboardChart = defineComponent({
  name: 'DashboardChart',
  props: {
    chartConfigFn: {
      required: true,
      type: Function as PropType<(data: any) => any>,
    },
    chartData: {
      default: null,
      type: null as unknown as PropType<any>,
    },
    processDataFn: {
      default: (data: any) => data,
      type: Function as PropType<(data: any) => any>,
    },
    showLoading: {
      default: true,
      type: Boolean,
    },
  },
  setup(props) {
    const chartRef = ref<EchartsUIType>();
    const loading = ref(false);
    const error = ref('');
    const isDataEmpty = ref(false);
    const { renderEcharts } = useEcharts(chartRef);

    const renderChart = async (data: any) => {
      try {
        loading.value = props.showLoading;
        error.value = '';
        isDataEmpty.value = false;

        const processedData = props.processDataFn(data);
        if (
          processedData === null ||
          processedData === undefined ||
          (Array.isArray(processedData) && processedData.length === 0) ||
          (typeof processedData === 'object' &&
            Object.keys(processedData).length === 0)
        ) {
          isDataEmpty.value = true;
          return;
        }

        await renderEcharts(props.chartConfigFn(processedData));
      } catch (error_) {
        console.error('图表渲染失败:', error_);
        error.value = error_ instanceof Error ? error_.message : '加载失败';
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      if (props.chartData) {
        renderChart(props.chartData);
      }
    });

    watch(
      () => [props.chartData, props.chartConfigFn],
      () => {
        if (props.chartData) {
          renderChart(props.chartData);
        }
      },
      { deep: true },
    );

    return () =>
      h('div', { class: 'relative h-full w-full' }, [
        loading.value
          ? h(
              'div',
              {
                class:
                  'absolute inset-0 flex items-center justify-center bg-white bg-opacity-60',
              },
              '加载中...',
            )
          : null,
        error.value
          ? h(
              'div',
              {
                class:
                  'absolute inset-0 flex items-center justify-center bg-white bg-opacity-60',
              },
              error.value,
            )
          : null,
        isDataEmpty.value
          ? h(
              'div',
              {
                class:
                  'absolute inset-0 flex items-center justify-center bg-white bg-opacity-60',
              },
              '暂无数据',
            )
          : null,
        h(EchartsUI, { ref: chartRef }),
      ]);
  },
});

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

const mockData = [
  { itemStyle: { color: '#3B82F6' }, name: '待处理', value: 5 },
  { itemStyle: { color: '#10B981' }, name: '待派单', value: 8 },
  { itemStyle: { color: '#F59E0B' }, name: '待接单', value: 3 },
  { itemStyle: { color: '#EF4444' }, name: '处理中', value: 12 },
  { itemStyle: { color: '#60A5FA' }, name: '处理完成', value: 86 },
];
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 flex flex-initial items-center justify-between">
      <div class="font-medium text-gray-600" :class="[sectionTitleFontSize]">
        维修工单
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
    <div
      class="grid min-h-0 flex-1 gap-2"
      :class="isMobile ? 'grid-cols-1' : 'grid-cols-2'"
    >
      <div
        class="flex flex-col rounded-lg bg-gray-50 p-2"
        :class="isMobile ? 'min-h-[180px]' : ''"
      >
        <div class="mb-1 text-center text-gray-500" :class="[titleFontSize]">
          处理进度
        </div>
        <div class="min-h-0 flex-1">
          <DashboardChart
            :chart-config-fn="
              (data: any) => getWorkOrderChartConfig(data, screenWidth)
            "
            :chart-data="mockData"
          />
        </div>
      </div>
      <div
        class="flex flex-col rounded-lg bg-gray-50 p-2"
        :class="isMobile ? 'min-h-[180px]' : ''"
      >
        <div class="mb-1 text-center text-gray-500" :class="[titleFontSize]">
          完成状态
        </div>
        <div class="min-h-0 flex-1">
          <DashboardChart
            :chart-config-fn="
              (data: any) => getWorkOrderChartConfig(data, screenWidth)
            "
            :chart-data="[
              { name: '未完成', value: 32, itemStyle: { color: '#3B82F6' } },
              { name: '已完成', value: 86, itemStyle: { color: '#10B981' } },
            ]"
          />
        </div>
      </div>
    </div>
  </div>
</template>
