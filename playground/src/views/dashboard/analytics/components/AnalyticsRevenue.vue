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

import { getAnalyticsRevenueOverview } from '#/api/analytics';

import { getRevenueChartConfig } from './chartConfigs';

interface Props {
  parkId?: number;
}

interface RevenueTrendData {
  expense: number[];
  income: number[];
  months: string[];
  net: number[];
}

const props = withDefaults(defineProps<Props>(), {
  parkId: -1,
});

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

const dotSize = computed(() => {
  if (isMobile.value) return 'w-2 h-2';
  return 'w-2.5 h-2.5';
});

const revenueSummary = ref({
  expenseTotal: 0,
  incomeTotal: 0,
  netTotal: 0,
  yearLabel: `${new Date().getFullYear()}年度`,
});
const revenueTrendData = ref<null | RevenueTrendData>(null);

const formatAmount = (value: number) =>
  `${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}元`;

const fetchRevenueOverview = async () => {
  try {
    const res = await getAnalyticsRevenueOverview(
      props.parkId === -1 ? undefined : { parkId: props.parkId },
    );

    if (!res) {
      return;
    }

    revenueSummary.value = {
      expenseTotal: Number(res.summary?.expenseTotal) || 0,
      incomeTotal: Number(res.summary?.incomeTotal) || 0,
      netTotal: Number(res.summary?.netTotal) || 0,
      yearLabel:
        typeof res.summary?.yearLabel === 'string' && res.summary.yearLabel
          ? res.summary.yearLabel
          : `${new Date().getFullYear()}年度`,
    };

    revenueTrendData.value = {
      expense: Array.isArray(res.trend?.expense) ? res.trend.expense : [],
      income: Array.isArray(res.trend?.income) ? res.trend.income : [],
      months: Array.isArray(res.trend?.months) ? res.trend.months : [],
      net: Array.isArray(res.trend?.net) ? res.trend.net : [],
    };
  } catch (error) {
    console.error('获取营收统计失败:', error);
  }
};

watch(
  () => props.parkId,
  () => {
    fetchRevenueOverview();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 grid flex-initial grid-cols-3 gap-2">
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div class="rounded-full bg-green-500" :class="[dotSize]"></div>
          <span class="text-gray-500" :class="[labelFontSize]">收入总额</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.incomeTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.yearLabel }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div class="rounded-full bg-blue-500" :class="[dotSize]"></div>
          <span class="text-gray-500" :class="[labelFontSize]">支出总额</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.expenseTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.yearLabel }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div class="rounded-full bg-orange-500" :class="[dotSize]"></div>
          <span class="text-gray-500" :class="[labelFontSize]">净收入</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.netTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.yearLabel }}
        </div>
      </div>
    </div>
    <div class="min-h-0 flex-1">
      <DashboardChart
        :chart-config-fn="(data: any) => getRevenueChartConfig(data, isMobile)"
        :chart-data="revenueTrendData"
      />
    </div>
  </div>
</template>
