<script lang="ts" setup>
import type { PropType } from 'vue';

import type { EchartsUIType } from '@vben/plugins/echarts';

import type { ParkOptionValue } from './parkOptions';

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

import { getDashboardRevenueStats } from '#/api/dashboard';

import { getRevenueChartConfig, REVENUE_COLORS } from './chartConfigs';

interface Props {
  month?: string;
  parkId?: ParkOptionValue;
}

interface RevenueTrendData {
  expense: number[];
  income: number[];
  months: string[];
  profit: number[];
}

const props = withDefaults(defineProps<Props>(), {
  month: '',
  parkId: 'all',
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
  periodLabel: '当前年度',
  profit: 0,
});
const revenueTrendData = ref<null | RevenueTrendData>(null);
const revenueProfitLabel = computed(() =>
  revenueSummary.value.profit < 0 ? '净支出' : '净收入',
);
const revenueProfitColor = computed(() =>
  revenueSummary.value.profit < 0
    ? REVENUE_COLORS.netExpense
    : REVENUE_COLORS.netIncome,
);

const formatAmount = (value: number) =>
  `${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}元`;

const fetchRevenueOverview = async () => {
  try {
    const res = await getDashboardRevenueStats({
      month: props.month,
      parkId: props.parkId,
    });

    if (!res) {
      return;
    }

    revenueSummary.value = {
      expenseTotal: Number(res.summary?.expenseTotal) || 0,
      incomeTotal: Number(res.summary?.incomeTotal) || 0,
      periodLabel: res.periodLabel || '当前年度',
      profit: Number(res.summary?.profit) || 0,
    };

    revenueTrendData.value = {
      expense: Array.isArray(res.trend?.expense) ? res.trend.expense : [],
      income: Array.isArray(res.trend?.income) ? res.trend.income : [],
      months: Array.isArray(res.trend?.months) ? res.trend.months : [],
      profit: Array.isArray(res.trend?.profit) ? res.trend.profit : [],
    };
  } catch (error) {
    console.error('获取营收统计失败:', error);
  }
};

watch(
  () => [props.parkId, props.month],
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
          <div
            class="rounded-full"
            :class="[dotSize]"
            :style="{ backgroundColor: REVENUE_COLORS.income }"
          ></div>
          <span class="text-gray-500" :class="[labelFontSize]">收入总额</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.incomeTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.periodLabel }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div
            class="rounded-full"
            :class="[dotSize]"
            :style="{ backgroundColor: REVENUE_COLORS.expense }"
          ></div>
          <span class="text-gray-500" :class="[labelFontSize]">支出总额</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.expenseTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.periodLabel }}
        </div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <div class="flex items-center gap-1.5">
          <div
            class="rounded-full"
            :class="[dotSize]"
            :style="{ backgroundColor: revenueProfitColor }"
          ></div>
          <span class="text-gray-500" :class="[labelFontSize]">
            {{ revenueProfitLabel }}
          </span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(Math.abs(revenueSummary.profit)) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.periodLabel }}
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
