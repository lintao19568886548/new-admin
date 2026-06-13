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

import { getDashboardContractStats } from '#/api/dashboard';

import { getContractTrendChartConfig } from './chartConfigs';

interface Props {
  date?: string;
  endDate?: string;
  parkId?: ParkOptionValue;
  startDate?: string;
}

interface ContractTrendData {
  dates: string[];
  expiring: number[];
  newThisMonth: number[];
  normal: number[];
  retreated: number[];
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
  if (isMobile.value) return 'text-sm';
  if (isTablet.value) return 'text-base';
  return 'text-lg';
});

const iconSize = computed(() => {
  if (isMobile.value) return 'w-5 h-5';
  return 'w-6 h-6';
});

const innerIconSize = computed(() => {
  if (isMobile.value) return 'w-1.5 h-1.5';
  return 'w-2 h-2';
});

const contractSummary = ref({
  expiring: 0,
  newThisMonth: 0,
  normal: 0,
  retreated: 0,
});

const contractTrendData = ref<ContractTrendData | null>(null);

function getMonthStart(date: string) {
  return date ? `${date.slice(0, 8)}01` : '';
}

function buildTenantQuery(
  view?: 'active' | 'expired' | 'expiring' | 'newThisMonth',
) {
  const query: Record<string, string> = {};
  if (props.parkId !== 'all') {
    query.parkId = String(props.parkId);
  }
  switch (view) {
    case 'active': {
      query.status = 'active';
      break;
    }
    case 'expired': {
      query.status = 'expired';
      break;
    }
    case 'expiring': {
      query.contractView = 'expiring';
      if (props.endDate || props.date) {
        query.date = props.endDate || props.date;
      }
      break;
    }
    case 'newThisMonth': {
      if (props.startDate && props.endDate) {
        query.contractStart = props.startDate;
        query.contractEnd = props.endDate;
      } else if (props.date) {
        query.contractStart = getMonthStart(props.date);
        query.contractEnd = props.date;
      }
      break;
    }
  }
  if (props.endDate || props.date) {
    query.date = props.endDate || props.date;
  }
  return query;
}

function goTenantList(
  view?: 'active' | 'expired' | 'expiring' | 'newThisMonth',
) {
  router.push({
    path: '/rental/tenant',
    query: buildTenantQuery(view),
  });
}

const fetchContractOverview = async () => {
  try {
    const res = await getDashboardContractStats({
      date: props.endDate || props.date,
      endDate: props.endDate,
      parkId: props.parkId,
      startDate: props.startDate,
    });
    if (!res) {
      return;
    }

    contractSummary.value = {
      expiring: Number(res.summary?.expiring) || 0,
      newThisMonth: Number(res.summary?.newThisMonth) || 0,
      normal: Number(res.summary?.normal) || 0,
      retreated: Number(res.summary?.retreated) || 0,
    };

    contractTrendData.value = {
      dates: Array.isArray(res.trend?.dates) ? res.trend.dates : [],
      expiring: Array.isArray(res.trend?.expiring) ? res.trend.expiring : [],
      newThisMonth: Array.isArray(res.trend?.newThisMonth)
        ? res.trend.newThisMonth
        : [],
      normal: Array.isArray(res.trend?.normal) ? res.trend.normal : [],
      retreated: Array.isArray(res.trend?.retreated) ? res.trend.retreated : [],
    };
  } catch (error) {
    console.error('获取合同总览失败:', error);
  }
};

watch(
  () => [props.parkId, props.date, props.startDate, props.endDate],
  () => {
    fetchContractOverview();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-3 grid flex-initial grid-cols-2 gap-2 md:grid-cols-4">
      <button
        class="summary-card rounded-lg bg-gray-50 p-2 text-center"
        type="button"
        @click="goTenantList('active')"
      >
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-blue-100"
          :class="[iconSize]"
        >
          <div class="rounded-full bg-blue-500" :class="[innerIconSize]"></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">
          {{ contractSummary.normal }}
        </div>
        <div class="text-gray-400" :class="[labelFontSize]">正常合同</div>
      </button>
      <button
        class="summary-card rounded-lg bg-gray-50 p-2 text-center"
        type="button"
        @click="goTenantList('newThisMonth')"
      >
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-orange-100"
          :class="[iconSize]"
        >
          <div
            class="rounded-full bg-orange-500"
            :class="[innerIconSize]"
          ></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">
          {{ contractSummary.newThisMonth }}
        </div>
        <div class="text-gray-400" :class="[labelFontSize]">本月新增</div>
      </button>
      <button
        class="summary-card rounded-lg bg-gray-50 p-2 text-center"
        type="button"
        @click="goTenantList('expiring')"
      >
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-green-100"
          :class="[iconSize]"
        >
          <div class="rounded-full bg-green-500" :class="[innerIconSize]"></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">
          {{ contractSummary.expiring }}
        </div>
        <div class="text-gray-400" :class="[labelFontSize]">即将到期</div>
      </button>
      <button
        class="summary-card rounded-lg bg-gray-50 p-2 text-center"
        type="button"
        @click="goTenantList('expired')"
      >
        <div
          class="mx-auto mb-1 flex items-center justify-center rounded-full bg-red-100"
          :class="[iconSize]"
        >
          <div class="rounded-full bg-red-500" :class="[innerIconSize]"></div>
        </div>
        <div class="font-bold text-gray-800" :class="[valueFontSize]">
          {{ contractSummary.retreated }}
        </div>
        <div class="text-gray-400" :class="[labelFontSize]">已到期</div>
      </button>
    </div>
    <div class="min-h-0 flex-1">
      <DashboardChart
        :chart-config-fn="
          (data: any) => getContractTrendChartConfig(data, isMobile)
        "
        :chart-data="contractTrendData"
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

.summary-card:hover {
  border-color: #d9e8ff;
  box-shadow: 0 4px 12px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}
</style>
