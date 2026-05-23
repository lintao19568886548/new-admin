<script lang="ts" setup>
import type { PropType } from 'vue';

import type { EchartsUIType } from '@vben/plugins/echarts';

import type { EnergyConsumptionType } from './chartConfigs';
import type { ParkOptionValue } from './parkOptions';

import type {
  DashboardEnergyElectricityStats,
  DashboardEnergyWaterStats,
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

import {
  getDashboardEnergyElectricityConsumption,
  getDashboardEnergyWaterConsumption,
} from '#/api/dashboard';

import { getEnergyConsumptionChartConfig } from './chartConfigs';

interface Props {
  parkId?: ParkOptionValue;
}

const props = withDefaults(defineProps<Props>(), {
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

const screenWidth = ref(window.innerWidth);
const isMobile = computed(() => screenWidth.value < 768);

const handleResize = () => {
  screenWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const activeConsumptionType = ref<EnergyConsumptionType>('water');

const currentYear = new Date().getFullYear();
const defaultMonths = Array.from({
  length: new Date().getMonth() + 1,
}).map((_item, index) => {
  const date = new Date(currentYear, index, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
});
const defaultElectricityStats: DashboardEnergyElectricityStats = {
  electricity: {
    consumption: Array.from({ length: defaultMonths.length }, () => 0),
    monthOnMonth: Array.from({ length: defaultMonths.length }, () => 0),
    yearOnYear: Array.from({ length: defaultMonths.length }, () => 0),
  },
  hasData: false,
  months: defaultMonths,
  year: currentYear,
};
const defaultWaterStats: DashboardEnergyWaterStats = {
  hasData: false,
  months: defaultMonths,
  water: {
    consumption: Array.from({ length: defaultMonths.length }, () => 0),
    monthOnMonth: Array.from({ length: defaultMonths.length }, () => 0),
    yearOnYear: Array.from({ length: defaultMonths.length }, () => 0),
  },
  year: currentYear,
};

const electricityStats = ref<DashboardEnergyElectricityStats>(
  defaultElectricityStats,
);
const waterStats = ref<DashboardEnergyWaterStats>(defaultWaterStats);

const chartData = computed(() => ({
  electricity: electricityStats.value.electricity,
  months:
    activeConsumptionType.value === 'water'
      ? waterStats.value.months
      : electricityStats.value.months,
  water: waterStats.value.water,
}));

const fetchElectricityStats = async () => {
  try {
    const res = await getDashboardEnergyElectricityConsumption({
      parkId: props.parkId,
      year: currentYear,
    });

    if (!res) return;

    electricityStats.value = {
      electricity: {
        consumption: Array.isArray(res.electricity?.consumption)
          ? res.electricity.consumption.map(Number)
          : defaultElectricityStats.electricity.consumption,
        monthOnMonth: Array.isArray(res.electricity?.monthOnMonth)
          ? res.electricity.monthOnMonth.map(Number)
          : defaultElectricityStats.electricity.monthOnMonth,
        yearOnYear: Array.isArray(res.electricity?.yearOnYear)
          ? res.electricity.yearOnYear.map(Number)
          : defaultElectricityStats.electricity.yearOnYear,
      },
      hasData: Boolean(res.hasData),
      message: res.message,
      months: Array.isArray(res.months)
        ? res.months
        : defaultElectricityStats.months,
      year: Number(res.year || currentYear),
    };
  } catch (error) {
    console.error('获取电消耗数据失败:', error);
    message.error('获取电消耗数据失败');
  }
};

const fetchWaterStats = async () => {
  try {
    const res = await getDashboardEnergyWaterConsumption({
      parkId: props.parkId,
      year: currentYear,
    });

    if (!res) return;

    waterStats.value = {
      hasData: Boolean(res.hasData),
      message: res.message,
      months: Array.isArray(res.months) ? res.months : defaultWaterStats.months,
      water: {
        consumption: Array.isArray(res.water?.consumption)
          ? res.water.consumption.map(Number)
          : defaultWaterStats.water.consumption,
        monthOnMonth: Array.isArray(res.water?.monthOnMonth)
          ? res.water.monthOnMonth.map(Number)
          : defaultWaterStats.water.monthOnMonth,
        yearOnYear: Array.isArray(res.water?.yearOnYear)
          ? res.water.yearOnYear.map(Number)
          : defaultWaterStats.water.yearOnYear,
      },
      year: Number(res.year || currentYear),
    };
  } catch (error) {
    console.error('获取水消耗数据失败:', error);
    message.error('获取水消耗数据失败');
  }
};

watch(
  () => props.parkId,
  () => {
    fetchElectricityStats();
    fetchWaterStats();
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-2 flex flex-initial items-center justify-between gap-2">
      <div class="flex rounded-md bg-gray-100 p-0.5">
        <button
          class="rounded px-3 py-1 text-xs transition-colors"
          :class="
            activeConsumptionType === 'water'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
          type="button"
          @click="activeConsumptionType = 'water'"
        >
          水
        </button>
        <button
          class="rounded px-3 py-1 text-xs transition-colors"
          :class="
            activeConsumptionType === 'electricity'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          "
          type="button"
          @click="activeConsumptionType = 'electricity'"
        >
          电
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1">
      <DashboardChart
        :chart-config-fn="
          (data: any) =>
            getEnergyConsumptionChartConfig(
              data,
              activeConsumptionType,
              isMobile,
            )
        "
        :chart-data="chartData"
      />
    </div>
  </div>
</template>
