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
import { useRouter } from 'vue-router';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getDashboardRevenueStats } from '#/api/dashboard';

import { getRevenueChartConfig, REVENUE_COLORS } from './chartConfigs';

interface Props {
  date?: string;
  endDate?: string;
  parkId?: ParkOptionValue;
  startDate?: string;
}

interface RevenueTrendData {
  expense: number[];
  income: number[];
  months: string[];
  profit: number[];
  receivable: number[];
  received: number[];
  remaining: number[];
}

const props = withDefaults(defineProps<Props>(), {
  date: '',
  endDate: '',
  parkId: 'all',
  startDate: '',
});
const router = useRouter();

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
  periodLabel: '当前年度',
  receivableTotal: 0,
  receivedTotal: 0,
  remainingTotal: 0,
});
const revenueTrendData = ref<null | RevenueTrendData>(null);
let revenueRequestSeq = 0;

const formatAmount = (value: number) =>
  `${Number(value || 0).toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}元`;

function getSelectedDateRange() {
  const startDate = props.startDate || props.date;
  const endDate = props.endDate || props.date || props.startDate;
  return {
    endDate,
    startDate,
  };
}

function appendParkQuery(query: Record<string, number | string>) {
  if (props.parkId === 'all' || props.parkId === undefined) {
    return;
  }

  const parkId = Number(props.parkId);
  if (Number.isInteger(parkId) && parkId > 0) {
    query.parkId = parkId;
  }
}

function getBillRouteQuery(collectionStatus?: 'unreceived') {
  const { endDate, startDate } = getSelectedDateRange();
  const query: Record<string, number | string> = {};
  appendParkQuery(query);

  if (startDate && endDate) {
    query.projectStartDate = startDate;
    query.projectEndDate = endDate;
  }

  if (collectionStatus) {
    query.collectionStatus = collectionStatus;
  }

  return query;
}

function goReceivableDetail() {
  router.push({
    name: 'Bill',
    query: getBillRouteQuery(),
  });
}

function goReceivedDetail() {
  router.push({
    name: 'Bill',
    query: getBillRouteQuery(),
  });
}

function goRemainingDetail() {
  router.push({
    name: 'Bill',
    query: getBillRouteQuery('unreceived'),
  });
}

const fetchRevenueOverview = async () => {
  const requestSeq = ++revenueRequestSeq;
  try {
    const res = await getDashboardRevenueStats({
      date: props.date,
      endDate: props.endDate,
      parkId: props.parkId,
      startDate: props.startDate,
    });

    if (requestSeq !== revenueRequestSeq) {
      return;
    }

    if (!res) {
      return;
    }

    revenueSummary.value = {
      periodLabel: res.periodLabel || '当前年度',
      receivableTotal:
        Number(res.summary?.receivableTotal ?? res.summary?.expenseTotal) || 0,
      receivedTotal:
        Number(res.summary?.receivedTotal ?? res.summary?.incomeTotal) || 0,
      remainingTotal:
        Number(
          res.summary?.remainingTotal ?? Math.abs(Number(res.summary?.profit)),
        ) || 0,
    };

    revenueTrendData.value = {
      expense: Array.isArray(res.trend?.expense) ? res.trend.expense : [],
      income: Array.isArray(res.trend?.income) ? res.trend.income : [],
      months: Array.isArray(res.trend?.months) ? res.trend.months : [],
      profit: Array.isArray(res.trend?.profit) ? res.trend.profit : [],
      receivable: Array.isArray(res.trend?.receivable)
        ? res.trend.receivable
        : [],
      received: Array.isArray(res.trend?.received) ? res.trend.received : [],
      remaining: Array.isArray(res.trend?.remaining) ? res.trend.remaining : [],
    };
  } catch (error) {
    if (requestSeq !== revenueRequestSeq) {
      return;
    }
    console.error('获取营收统计失败:', error);
  }
};

watch(
  () => [props.parkId, props.date, props.startDate, props.endDate],
  () => {
    fetchRevenueOverview();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 grid flex-initial grid-cols-3 gap-2">
      <button
        class="summary-card rounded-lg bg-gray-50 p-2 text-left"
        type="button"
        @click="goReceivableDetail"
      >
        <div class="flex items-center gap-1.5">
          <div
            class="rounded-full"
            :class="[dotSize]"
            :style="{ backgroundColor: REVENUE_COLORS.expense }"
          ></div>
          <span class="text-gray-500" :class="[labelFontSize]">应收合计</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.receivableTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.periodLabel }}
        </div>
      </button>
      <button
        class="summary-card rounded-lg bg-gray-50 p-2 text-left"
        type="button"
        @click="goReceivedDetail"
      >
        <div class="flex items-center gap-1.5">
          <div
            class="rounded-full"
            :class="[dotSize]"
            :style="{ backgroundColor: REVENUE_COLORS.income }"
          ></div>
          <span class="text-gray-500" :class="[labelFontSize]">实收合计</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.receivedTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.periodLabel }}
        </div>
      </button>
      <button
        class="summary-card rounded-lg bg-gray-50 p-2 text-left"
        type="button"
        @click="goRemainingDetail"
      >
        <div class="flex items-center gap-1.5">
          <div
            class="rounded-full"
            :class="[dotSize]"
            :style="{ backgroundColor: REVENUE_COLORS.netExpense }"
          ></div>
          <span class="text-gray-500" :class="[labelFontSize]">未收合计</span>
        </div>
        <div
          class="mt-1 whitespace-nowrap font-bold text-gray-800"
          :class="[valueFontSize]"
        >
          {{ formatAmount(revenueSummary.remainingTotal) }}
        </div>
        <div class="mt-0.5 text-gray-400" :class="[labelFontSize]">
          {{ revenueSummary.periodLabel }}
        </div>
      </button>
    </div>
    <div class="min-h-0 flex-1">
      <DashboardChart
        :chart-config-fn="(data: any) => getRevenueChartConfig(data, isMobile)"
        :chart-data="revenueTrendData"
      />
    </div>
  </div>
</template>

<style scoped>
.summary-card {
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.summary-card:hover,
.summary-card:focus-visible {
  border-color: #d9e8ff;
  box-shadow: 0 4px 12px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.summary-card:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}
</style>
