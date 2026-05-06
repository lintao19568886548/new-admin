<script lang="ts" setup>
import type { Dayjs } from 'dayjs';
import type { EChartsOption } from 'echarts';

import type { PropType } from 'vue';

import type { EchartsUIType } from '@vben/plugins/echarts';

import type {
  ReimbursementAnalysisResponse,
  ReimbursementParkStat,
  ReimbursementTrendStat,
} from '#/api/reimbursement';

import {
  computed,
  defineComponent,
  h,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  message,
  Select,
  Spin,
  Table,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getReimbursementAnalysis } from '#/api/reimbursement';

defineProps<Props>();

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
      h('div', { class: 'relative h-64 w-full' }, [
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

interface Props {
  parkOptions: Array<{ label: string; value: number | string }>;
}

type DateRangeValue = [Dayjs, Dayjs];

function getCurrentMonthRange(): DateRangeValue {
  return [dayjs().startOf('month'), dayjs().endOf('month')];
}

function createEmptyAnalysisData(): ReimbursementAnalysisResponse {
  return {
    parkStats: [],
    summary: {
      averageAmount: 0,
      count: 0,
      parkCount: 0,
      totalAmount: 0,
    },
    topParks: [],
    trend: [],
  };
}

const loading = ref(false);
const analysisData = ref<ReimbursementAnalysisResponse>(
  createEmptyAnalysisData(),
);

const filters = reactive<{
  dateRange: DateRangeValue;
  parkId: number | undefined;
}>({
  dateRange: getCurrentMonthRange(),
  parkId: undefined,
});

const rankingColumns = [
  {
    dataIndex: 'park',
    key: 'park',
    title: '园区',
  },
  {
    customRender: ({ text }: { text: number }) =>
      `￥${Number(text).toFixed(2)}`,
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    title: '已通过金额',
  },
  {
    dataIndex: 'count',
    key: 'count',
    title: '单据数',
  },
  {
    customRender: ({ text }: { text: number }) =>
      `${(Number(text) * 100).toFixed(2)}%`,
    dataIndex: 'ratio',
    key: 'ratio',
    title: '金额占比',
  },
];

const hasData = computed(() => analysisData.value.summary.count > 0);

const parkChartData = computed(() => analysisData.value.parkStats);
const trendChartData = computed(() => analysisData.value.trend);

function getParkChartConfig(data: ReimbursementParkStat[]): EChartsOption {
  return {
    grid: {
      bottom: '8%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '8%',
    },
    series: [
      {
        barMaxWidth: 60,
        data: data.map((item) => Number(item.totalAmount.toFixed(2))),
        name: '已通过金额',
        type: 'bar',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 25,
      },
      data: data.map((item) => item.park),
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        formatter: '{value} 元',
      },
      type: 'value',
    },
  };
}

function getTrendChartConfig(data: ReimbursementTrendStat[]): EChartsOption {
  return {
    grid: {
      bottom: '8%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '8%',
    },
    series: [
      {
        data: data.map((item) => Number(item.totalAmount.toFixed(2))),
        name: '已通过金额',
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 30,
      },
      data: data.map((item) => item.date),
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        formatter: '{value} 元',
      },
      type: 'value',
    },
  };
}

async function fetchAnalysis() {
  loading.value = true;
  try {
    const [startDate, endDate] = filters.dateRange;
    const result = await getReimbursementAnalysis({
      endDate: endDate.format('YYYY-MM-DD'),
      parkId: filters.parkId,
      startDate: startDate.format('YYYY-MM-DD'),
      status: 1,
    });
    analysisData.value = {
      ...createEmptyAnalysisData(),
      ...result,
    };
  } catch (error) {
    console.error('加载报销分析失败:', error);
    message.error('加载报销分析失败');
    analysisData.value = createEmptyAnalysisData();
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.dateRange = getCurrentMonthRange();
  filters.parkId = undefined;
  void fetchAnalysis();
}

onMounted(() => {
  void fetchAnalysis();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-3 rounded-md bg-white p-4 shadow-sm">
      <DatePicker.RangePicker
        v-model:value="filters.dateRange"
        :allow-clear="false"
        class="w-72"
      />
      <Select
        v-model:value="filters.parkId"
        :options="parkOptions"
        allow-clear
        class="w-48"
        placeholder="按园区筛选"
      />
      <Button type="primary" @click="fetchAnalysis">查询</Button>
      <Button @click="resetFilters">重置</Button>
    </div>

    <Spin :spinning="loading" tip="加载中...">
      <div v-if="hasData" class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <Card size="small">
            <div class="text-sm text-gray-500">已通过总金额</div>
            <div class="mt-1 text-xl font-semibold text-emerald-600">
              ￥{{ Number(analysisData.summary.totalAmount).toFixed(2) }}
            </div>
          </Card>
          <Card size="small">
            <div class="text-sm text-gray-500">单据数</div>
            <div class="mt-1 text-xl font-semibold">
              {{ analysisData.summary.count }}
            </div>
          </Card>
          <Card size="small">
            <div class="text-sm text-gray-500">园区数</div>
            <div class="mt-1 text-xl font-semibold">
              {{ analysisData.summary.parkCount }}
            </div>
          </Card>
          <Card size="small">
            <div class="text-sm text-gray-500">平均单笔金额</div>
            <div class="mt-1 text-xl font-semibold">
              ￥{{ Number(analysisData.summary.averageAmount).toFixed(2) }}
            </div>
          </Card>
        </div>

        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card size="small" title="各园区报销金额分布">
            <DashboardChart
              :chart-config-fn="getParkChartConfig"
              :chart-data="parkChartData"
            />
          </Card>
          <Card size="small" title="报销金额日趋势">
            <DashboardChart
              :chart-config-fn="getTrendChartConfig"
              :chart-data="trendChartData"
            />
          </Card>
        </div>

        <Card size="small" title="园区排行（按金额降序）">
          <Table
            :columns="rankingColumns"
            :data-source="analysisData.topParks"
            :pagination="false"
            row-key="parkId"
            size="small"
          />
        </Card>
      </div>
      <Empty v-else description="暂无分析数据" />
    </Spin>
  </div>
</template>
