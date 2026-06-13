<script lang="ts" setup>
import type { PropType } from 'vue';

import type { EchartsUIType } from '@vben/plugins/echarts';

import type { ParkOptionValue } from './parkOptions';

import type {
  DashboardMeterStatisticsDateType,
  DashboardMeterStatisticsStats,
  DashboardMeterStatisticsType,
} from '#/api/dashboard';

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

import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { getDashboardMeterStatistics } from '#/api/dashboard';

import {
  getCountStatisticsChartConfig,
  getDailyWaterTrendChartConfig,
  getElectricityPieChartConfig,
} from './chartConfigs';

interface Props {
  endDate?: string;
  parkId?: ParkOptionValue;
  startDate?: string;
}

const props = withDefaults(defineProps<Props>(), {
  endDate: '',
  parkId: 'all',
  startDate: '',
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

const activeStatisticsType = ref<DashboardMeterStatisticsType>('electricity');
const dateType = ref<DashboardMeterStatisticsDateType>('month');
const meterStatistics = ref<DashboardMeterStatisticsStats>({
  dateType: 'month',
  dayNight: [
    { name: '普通表', value: 0 },
    { name: '时段表', value: 0 },
  ],
  hasData: false,
  peakValley: [
    { name: '尖', value: 0 },
    { name: '峰', value: 0 },
    { name: '平', value: 0 },
    { name: '谷', value: 0 },
  ],
  selectedDate: dayjs().format('YYYY-MM'),
  statisticsType: 'electricity',
  summary: {
    deviceCount: 0,
    recordCount: 0,
    total: 0,
  },
  waterTrend: {
    times: [],
    values: [],
  },
});

const dateValueFormat = computed(() =>
  dateType.value === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD',
);
const getPeakValleyColor = (name: string) => {
  const colors: Record<string, string> = {
    尖: '#EF4444',
    峰: '#F97316',
    平: '#3B82F6',
    谷: '#10B981',
  };

  return colors[name] || '#6B7280';
};
const getMeterCategoryColor = (name: string) =>
  name === '普通表' ? '#5ab1ef' : '#91cc75';

const peakValleyData = computed(() =>
  meterStatistics.value.peakValley.map((item) => ({
    ...item,
    itemStyle: { color: getPeakValleyColor(item.name) },
  })),
);
const dayNightData = computed(() =>
  meterStatistics.value.dayNight.map((item) => ({
    ...item,
    itemStyle: { color: getMeterCategoryColor(item.name) },
  })),
);
const emptyWaterTrendData = computed(() => {
  if (dateType.value === 'month') {
    const referenceDate = dayjs(props.endDate || props.startDate);
    const daysInMonth = referenceDate.isValid()
      ? referenceDate.daysInMonth()
      : dayjs().daysInMonth();

    return {
      times: Array.from({ length: daysInMonth }).map(
        (_item, index) => `${index + 1}日`,
      ),
      values: Array.from({ length: daysInMonth }, () => 0),
    };
  }

  return {
    times: Array.from({ length: 24 }).map((_item, index) => `${index}时`),
    values: Array.from({ length: 24 }, () => 0),
  };
});
const waterTrendData = computed(() => {
  const times = meterStatistics.value.waterTrend.times;
  const values = meterStatistics.value.waterTrend.values;

  return times.length > 0 && values.length > 0
    ? meterStatistics.value.waterTrend
    : emptyWaterTrendData.value;
});

const electricityGridClass = computed(() =>
  isMobile.value ? 'grid-cols-1' : 'grid-cols-2',
);

const waterChartClass = computed(() => (isMobile.value ? 'min-h-[220px]' : ''));

const fetchMeterStatistics = async () => {
  try {
    const res = await getDashboardMeterStatistics({
      date: props.endDate || props.startDate,
      dateType: dateType.value,
      endDate: props.endDate,
      parkId: props.parkId,
      startDate: props.startDate,
      type: activeStatisticsType.value,
    });

    if (!res) return;

    meterStatistics.value = {
      dateType: res.dateType || dateType.value,
      dayNight: Array.isArray(res.dayNight) ? res.dayNight : [],
      hasData: Boolean(res.hasData),
      message: res.message,
      peakValley: Array.isArray(res.peakValley) ? res.peakValley : [],
      selectedDate:
        res.selectedDate ||
        dayjs(props.endDate || props.startDate).format(dateValueFormat.value),
      statisticsType: res.statisticsType || activeStatisticsType.value,
      summary: {
        deviceCount: Number(res.summary?.deviceCount || 0),
        recordCount: Number(res.summary?.recordCount || 0),
        total: Number(res.summary?.total || 0),
      },
      waterTrend: {
        times: Array.isArray(res.waterTrend?.times) ? res.waterTrend.times : [],
        values: Array.isArray(res.waterTrend?.values)
          ? res.waterTrend.values.map(Number)
          : [],
      },
    };
  } catch (error) {
    console.error('获取表计数量统计数据失败:', error);
    message.error('获取表计数量统计数据失败');
  }
};

watch(
  [
    activeStatisticsType,
    dateType,
    () => props.parkId,
    () => props.startDate,
    () => props.endDate,
  ],
  () => {
    fetchMeterStatistics();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="meter-statistics-toolbar mb-2 flex-initial">
      <div
        class="meter-statistics-switch meter-statistics-type-switch rounded-md bg-gray-100 p-0.5"
      >
        <button
          class="rounded px-3 py-1 text-xs transition-colors"
          :class="
            activeStatisticsType === 'electricity'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
          type="button"
          @click="activeStatisticsType = 'electricity'"
        >
          用电统计
        </button>
      </div>
      <div
        class="meter-statistics-switch meter-statistics-date-switch rounded-md bg-gray-100 p-0.5"
      >
        <button
          class="rounded px-3 py-1 text-xs transition-colors"
          :class="
            dateType === 'month'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
          type="button"
          @click="dateType = 'month'"
        >
          按月
        </button>
        <button
          class="rounded px-3 py-1 text-xs transition-colors"
          :class="
            dateType === 'day'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
          type="button"
          @click="dateType = 'day'"
        >
          按日
        </button>
      </div>
    </div>
    <div
      v-if="activeStatisticsType === 'electricity'"
      class="grid min-h-0 flex-1 gap-2"
      :class="electricityGridClass"
    >
      <div class="flex flex-col rounded-lg bg-gray-50 p-2">
        <div class="flex-1">
          <DashboardChart
            :chart-config-fn="
              (data: any) => getElectricityPieChartConfig(data, screenWidth)
            "
            :chart-data="peakValleyData"
          />
        </div>
      </div>
      <div class="flex flex-col rounded-lg bg-gray-50 p-2">
        <div class="flex-1">
          <DashboardChart
            :chart-config-fn="
              (data: any) => getCountStatisticsChartConfig(data, screenWidth)
            "
            :chart-data="dayNightData"
          />
        </div>
      </div>
    </div>
    <div
      v-else
      class="min-h-0 flex-1 rounded-lg bg-gray-50 p-2"
      :class="waterChartClass"
    >
      <DashboardChart
        :chart-config-fn="
          (data: any) => getDailyWaterTrendChartConfig(data, isMobile)
        "
        :chart-data="waterTrendData"
      />
    </div>
  </div>
</template>

<style scoped>
.meter-statistics-toolbar {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: 8px;
  align-items: center;
}

.meter-statistics-switch {
  display: inline-flex;
  width: max-content;
  white-space: nowrap;
}

.meter-statistics-type-switch {
  grid-row: 1;
  grid-column: 1;
}

.meter-statistics-date-switch {
  grid-column: 2;
}

@media (min-width: 768px) {
  .meter-statistics-toolbar {
    display: flex;
    gap: 8px;
  }

  .meter-statistics-date-switch {
    margin-left: auto;
  }
}
</style>
