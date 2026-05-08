<script lang="ts" setup>
import type { PropType } from 'vue';

import type { EchartsUIType } from '@vben/plugins/echarts';

import type { ParkOptionValue } from './parkOptions';

import type { DashboardCustomerOverviewStats } from '#/api/dashboard';

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

import { getDashboardCustomerOverviewStats } from '#/api/dashboard';

import {
  getCustomerIntentLevelChartConfig,
  getNegotiationProgressChartConfig,
} from './chartConfigs';

interface Props {
  parkId?: ParkOptionValue;
}

const props = withDefaults(defineProps<Props>(), {
  parkId: 'all',
});

const defaultCustomerStats: DashboardCustomerOverviewStats = {
  intentLevels: [],
  negotiationProgress: [],
  summary: {
    currentMonthNewCustomers: 0,
    negotiatingCustomers: 0,
    receivedCustomers: 0,
    totalCustomers: 0,
  },
};

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

const customerStats = ref(defaultCustomerStats);

const fetchCustomerStats = async () => {
  try {
    const res = await getDashboardCustomerOverviewStats({
      parkId: props.parkId,
    });
    if (res) {
      customerStats.value = {
        intentLevels: res.intentLevels || [],
        negotiationProgress: res.negotiationProgress || [],
        summary: {
          currentMonthNewCustomers: res.summary?.currentMonthNewCustomers || 0,
          negotiatingCustomers: res.summary?.negotiatingCustomers || 0,
          receivedCustomers: res.summary?.receivedCustomers || 0,
          totalCustomers: res.summary?.totalCustomers || 0,
        },
      };
    }
  } catch (error) {
    console.error('获取客户总览统计数据失败:', error);
  }
};

watch(
  () => props.parkId,
  () => {
    fetchCustomerStats();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 grid flex-initial grid-cols-2 gap-2">
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
        <div class="font-bold text-gray-800" :class="[valueFontSize]">
          {{ customerStats.summary.totalCustomers }}
        </div>
        <div class="text-gray-400" :class="[labelFontSize]">接待客户</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2 text-center">
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-green-100"
          :class="[iconSize]"
        >
          <div class="rounded-full bg-green-500" :class="[innerIconSize]"></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">
          {{ customerStats.summary.currentMonthNewCustomers }}
        </div>
        <div class="text-gray-400" :class="[labelFontSize]">签约完成</div>
      </div>
    </div>
    <div class="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
      <div class="flex flex-col rounded-lg bg-gray-50 p-2 md:p-3">
        <div class="min-h-0 flex-1">
          <DashboardChart
            :chart-config-fn="
              (data: any) =>
                getCustomerIntentLevelChartConfig(data, screenWidth)
            "
            :chart-data="customerStats.intentLevels"
          />
        </div>
      </div>
      <div class="flex flex-col rounded-lg bg-gray-50 p-2 md:p-3">
        <div class="min-h-0 flex-1">
          <DashboardChart
            :chart-config-fn="
              (data: any) =>
                getNegotiationProgressChartConfig(data, screenWidth)
            "
            :chart-data="customerStats.negotiationProgress"
          />
        </div>
      </div>
    </div>
  </div>
</template>
