<script lang="ts" setup>
import type { EChartsOption } from 'echarts';

import type { PropType } from 'vue';

import type { EchartsUIType } from '@vben/plugins/echarts';

import type { RadarLead } from './data';

import type {
  PublicOpportunityItem,
  RadarAnalysisSourceStat,
  RadarAnalysisSummary,
  RadarCollectTask,
} from '#/api/investment';

import { computed, defineComponent, h, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { useMediaQuery } from '@vueuse/core';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
} from 'ant-design-vue';

import {
  getEffectivePublicOpportunityList,
  getRadarAnalysisSummary,
  getRadarCollectTask,
  getRadarLeadList,
} from '#/api/investment';

import { RADAR_STAGE_LABEL_MAP } from './data';

defineOptions({ name: 'InvestmentRadarDashboard' });

const DashboardChart = defineComponent({
  name: 'RadarDashboardChart',
  props: {
    chartData: {
      default: null,
      type: null as unknown as PropType<any>,
    },
    getOptions: {
      required: true,
      type: Function as PropType<(data: any) => EChartsOption>,
    },
    height: {
      default: '260px',
      type: String,
    },
    placeholder: {
      default: '暂无数据',
      type: String,
    },
  },
  setup(props) {
    const chartRef = ref<EchartsUIType>();
    const error = ref('');
    const isDataEmpty = ref(false);
    const { getChartInstance, renderEcharts } = useEcharts(chartRef);

    const renderChart = async () => {
      try {
        error.value = '';
        isDataEmpty.value = isEmptyChartData(props.chartData);
        if (isDataEmpty.value) {
          getChartInstance()?.clear();
          return;
        }
        await renderEcharts(props.getOptions(props.chartData));
      } catch (error_) {
        console.error('招商看板图表渲染失败:', error_);
        error.value = error_ instanceof Error ? error_.message : '加载失败';
      }
    };

    onMounted(() => {
      void renderChart();
    });

    watch(
      () => [props.chartData, props.getOptions],
      () => {
        void renderChart();
      },
      { deep: true },
    );

    return () =>
      h('div', { class: 'radar-chart', style: { height: props.height } }, [
        h(EchartsUI, { height: '100%', ref: chartRef }),
        isDataEmpty.value || error.value
          ? h(
              'div',
              { class: 'radar-chart-placeholder' },
              error.value || props.placeholder,
            )
          : null,
      ]);
  },
});

const router = useRouter();
const route = useRoute();
const isMobile = useMediaQuery('(max-width: 767px)');
const loading = ref(true);
const loadError = ref('');
const analysis = ref<null | RadarAnalysisSummary>(null);
const leads = ref<RadarLead[]>([]);
const opportunities = ref<PublicOpportunityItem[]>([]);
const latestTask = ref<null | RadarCollectTask>(null);

const summary = computed(() => {
  const funnel = analysis.value?.funnel;
  if (funnel) {
    return {
      activeLeads: funnel.activeLeads,
      highPriority: funnel.highPriorityLeads,
      replied: funnel.contactedLeads,
      totalLeads: funnel.totalLeads,
    };
  }

  const leadItems = leads.value;
  return {
    activeLeads: leadItems.filter((item) => item.stage !== 'INVALID').length,
    highPriority: leadItems.filter((item) => item.priorityLevel === 'A').length,
    replied: leadItems.filter((item) =>
      ['CONTACTED', 'DEAL', 'REPLIED', 'VISIT'].includes(item.stage),
    ).length,
    totalLeads: leadItems.length,
  };
});

const processLineChartData = computed(() => {
  const funnel = analysis.value?.funnel;
  if (funnel) {
    return [
      {
        name: '待触达',
        value: Math.max(funnel.totalLeads - funnel.contactedLeads, 0),
      },
      {
        name: '已触达',
        value: Math.max(funnel.contactedLeads - funnel.repliedLeads, 0),
      },
      {
        name: '已回复',
        value: Math.max(funnel.repliedLeads - funnel.visitLeads, 0),
      },
      {
        name: '已带看',
        value: Math.max(funnel.visitLeads - funnel.dealLeads, 0),
      },
      { name: '已成交', value: funnel.dealLeads },
    ];
  }

  const stageMap = new Map<string, number>();
  for (const lead of leads.value) {
    const label = getStageLabel(lead.stage);
    stageMap.set(label, (stageMap.get(label) || 0) + 1);
  }
  return [...stageMap.entries()].map(([name, value]) => ({ name, value }));
});

const conversionLineChartData = computed(() => {
  const funnel = analysis.value?.funnel;
  if (!funnel) {
    return [];
  }
  return [
    { name: '触达率', value: funnel.contactRate },
    { name: '回复率', value: funnel.replyRate },
    { name: '带看率', value: funnel.visitRate },
    { name: '成交率', value: funnel.dealRate },
  ];
});

const sourceBarChartData = computed(() => analysis.value?.sourceStats || []);

type ScoreScatterChartItem = {
  name: string;
  priorityLevel: string;
  value: [number, number, number];
};

type ScoreScatterChartDisplayItem = Omit<ScoreScatterChartItem, 'value'> & {
  originalValue: [number, number, number];
  value: [number, number, number, number, number];
};

const scoreScatterChartData = computed<ScoreScatterChartItem[]>(() =>
  leads.value.map((lead, index) => ({
    name: lead.enterpriseName || `潜客${index + 1}`,
    priorityLevel: lead.priorityLevel,
    value: [
      toFiniteChartNumber(lead.totalScore),
      toFiniteChartNumber(lead.intentScore),
      toFiniteChartNumber(lead.reachableScore),
    ] as [number, number, number],
  })),
);

const latestTaskStatusText = computed(() => {
  const status = latestTask.value?.status;
  if (!status) {
    return '暂无';
  }
  return (
    {
      FAILED: '失败',
      PENDING: '处理中',
      RUNNING: '处理中',
      SUCCESS: '成功',
    }[status] || status
  );
});

const mobileFunnelSteps = computed(() => {
  const funnel = analysis.value?.funnel;
  if (funnel) {
    return [
      { label: '线索', value: funnel.totalLeads },
      { label: '触达', value: funnel.contactedLeads },
      { label: '回复', value: funnel.repliedLeads },
      { label: '带看', value: funnel.visitLeads },
      { label: '成交', value: funnel.dealLeads },
    ];
  }
  return processLineChartData.value.map((item) => ({
    label: item.name,
    value: item.value,
  }));
});

const mobileRateItems = computed(() => {
  const funnel = analysis.value?.funnel;
  if (!funnel) {
    return conversionLineChartData.value.map((item) => ({
      label: item.name,
      value: item.value,
    }));
  }
  return [
    { label: '触达率', value: funnel.contactRate },
    { label: '回复率', value: funnel.replyRate },
    { label: '带看率', value: funnel.visitRate },
    { label: '成交率', value: funnel.dealRate },
  ];
});

const mobileSourceHighlights = computed(() =>
  (analysis.value?.sourceStats || []).slice(0, 3),
);

const mobileSignalHighlights = computed(() =>
  (analysis.value?.signalTypeStats || []).slice(0, 3),
);

const mobileOwnerHighlights = computed(() =>
  (analysis.value?.ownerStats || []).slice(0, 3),
);

function getPriorityColor(priorityLevel?: null | string) {
  if (priorityLevel === 'A') {
    return 'red';
  }
  if (priorityLevel === 'B') {
    return 'orange';
  }
  return 'blue';
}

function getPriorityChartColor(priorityLevel?: null | string) {
  if (priorityLevel === 'A') {
    return '#f5222d';
  }
  if (priorityLevel === 'B') {
    return '#faad14';
  }
  return '#1677ff';
}

function getStageLabel(stage?: null | string) {
  if (!stage) {
    return '-';
  }
  return RADAR_STAGE_LABEL_MAP[stage] || stage;
}

function getOpportunityTypeLabel(type?: null | string) {
  if (type === 'DEMAND') {
    return '需求';
  }
  if (type === 'SUPPLY') {
    return '房源';
  }
  return '-';
}

function getOpportunityLocation(record: PublicOpportunityItem) {
  return [record.city, record.district].filter(Boolean).join(' / ') || '-';
}

function getOpportunityArea(record: PublicOpportunityItem) {
  return record.areaText || (record.areaSqm ? `${record.areaSqm}㎡` : '-');
}

function getSuggestionColor(level: string) {
  if (level === 'danger') {
    return 'red';
  }
  if (level === 'success') {
    return 'green';
  }
  return 'orange';
}

function toFiniteChartNumber(value: unknown) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function isZeroChartValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.every((item) => toFiniteChartNumber(item) === 0);
  }
  return toFiniteChartNumber(value) === 0;
}

function isEmptyChartData(data: unknown) {
  if (data === null || data === undefined) {
    return true;
  }
  if (Array.isArray(data)) {
    return data.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'value' in item &&
        isZeroChartValue((item as { value?: unknown }).value),
    );
  }
  return false;
}

function getLineChartConfig(
  data: Array<{ name: string; value: number }>,
): EChartsOption {
  return {
    color: ['#1677ff'],
    grid: {
      bottom: 28,
      containLabel: true,
      left: 8,
      right: 18,
      top: 20,
    },
    series: [
      {
        areaStyle: {
          opacity: 0.08,
        },
        data: data.map((item) => item.value),
        label: {
          show: true,
        },
        smooth: true,
        symbolSize: 8,
        type: 'line',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        interval: 0,
      },
      data: data.map((item) => item.name),
      type: 'category',
    },
    yAxis: {
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

function getRateLineChartConfig(
  data: Array<{ name: string; value: number }>,
): EChartsOption {
  return {
    ...getLineChartConfig(data),
    color: ['#52c41a'],
    yAxis: {
      axisLabel: {
        formatter: '{value}%',
      },
      max: 100,
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

function getSourceBarChartConfig(
  data: RadarAnalysisSourceStat[],
): EChartsOption {
  const items = data.slice(0, 6).reverse();
  return {
    color: ['#1677ff', '#faad14'],
    grid: {
      bottom: 12,
      containLabel: true,
      left: 8,
      right: 24,
      top: 16,
    },
    series: [
      {
        data: items.map((item) => item.convertedLeads),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
        },
        label: {
          position: 'right',
          show: true,
        },
        name: '转雷达',
        type: 'bar',
      },
      {
        data: items.map((item) => item.highConfidenceLeads),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
        },
        name: '高可信',
        type: 'bar',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
    yAxis: {
      data: items.map((item) => item.sourceName),
      type: 'category',
    },
  };
}

function getScoreAxisMax(
  data: ScoreScatterChartItem[],
  dimensionIndex: number,
) {
  const maxValue = Math.max(
    0,
    ...data.map((item) => toFiniteChartNumber(item.value[dimensionIndex])),
  );
  return Math.max(100, Math.ceil(maxValue / 10) * 10);
}

function getScoreAxisMin(
  data: ScoreScatterChartItem[],
  dimensionIndex: number,
) {
  if (data.length === 0) {
    return 0;
  }

  const minValue = Math.min(
    ...data.map((item) => toFiniteChartNumber(item.value[dimensionIndex])),
  );
  return minValue <= 0 ? -5 : 0;
}

function formatScoreAxisLabel(value: number) {
  return value < 0 ? '' : String(value);
}

function formatScatterLeadName(name?: string) {
  if (!name) {
    return '-';
  }
  return name.length > 10 ? `${name.slice(0, 10)}...` : name;
}

function clampScoreChartValue(value: number, min: number, max: number) {
  if (max <= min + 2) {
    return value;
  }
  return Math.min(max - 1, Math.max(min + 1, value));
}

function spreadScoreScatterData(
  data: ScoreScatterChartItem[],
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): ScoreScatterChartDisplayItem[] {
  const groupMap = new Map<string, ScoreScatterChartItem[]>();
  data.forEach((item) => {
    const key = `${Math.round(item.value[0])}:${Math.round(item.value[1])}`;
    const group = groupMap.get(key) || [];
    group.push(item);
    groupMap.set(key, group);
  });

  return [...groupMap.values()].flatMap((group) =>
    group.map((item, index) => {
      const originalValue = item.value;
      if (group.length === 1) {
        return {
          ...item,
          originalValue,
          value: [
            originalValue[0],
            originalValue[1],
            originalValue[2],
            originalValue[0],
            originalValue[1],
          ],
        };
      }

      const angle = (Math.PI * 2 * index) / group.length;
      const radius = Math.min(4, 1.8 + group.length * 0.25);
      const displayX = clampScoreChartValue(
        originalValue[0] + Math.cos(angle) * radius,
        xMin,
        xMax,
      );
      const displayY = clampScoreChartValue(
        originalValue[1] + Math.sin(angle) * radius,
        yMin,
        yMax,
      );

      return {
        ...item,
        originalValue,
        value: [
          displayX,
          displayY,
          originalValue[2],
          originalValue[0],
          originalValue[1],
        ],
      };
    }),
  );
}

function getScoreScatterChartConfig(
  data: ScoreScatterChartItem[],
): EChartsOption {
  const xMin = getScoreAxisMin(data, 0);
  const xMax = getScoreAxisMax(data, 0);
  const yMin = getScoreAxisMin(data, 1);
  const yMax = getScoreAxisMax(data, 1);
  const chartData = spreadScoreScatterData(data, xMin, xMax, yMin, yMax);

  return {
    color: ['#f5222d', '#faad14', '#1677ff'],
    grid: {
      bottom: 34,
      containLabel: true,
      left: 10,
      right: 26,
      top: 28,
    },
    series: [
      {
        clip: false,
        data: chartData,
        emphasis: {
          focus: 'self',
          label: {
            show: true,
          },
        },
        encode: {
          tooltip: [3, 4, 2],
          x: 0,
          y: 1,
        },
        itemStyle: {
          color: (params: any) =>
            getPriorityChartColor(params.data?.priorityLevel),
          opacity: 0.88,
          shadowBlur: 6,
          shadowColor: 'rgba(0, 0, 0, 0.12)',
        },
        label: {
          color: '#4b5563',
          fontSize: 11,
          formatter: ({ name }: { name: string }) =>
            formatScatterLeadName(name),
          position: 'top',
          show: false,
        },
        symbolSize: (value: unknown) => {
          const scoreValue = Array.isArray(value)
            ? toFiniteChartNumber(value[2])
            : 0;
          return Math.max(18, Math.min(32, scoreValue / 3));
        },
        type: 'scatter',
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        const value =
          params.data?.originalValue ||
          (Array.isArray(params.value) ? params.value : []);
        return `${params.name}<br/>总分：${value[0] ?? '-'}<br/>意图分：${
          value[1] ?? '-'
        }<br/>可触达分：${value[2] ?? '-'}`;
      },
    },
    xAxis: {
      axisLabel: {
        formatter: formatScoreAxisLabel,
      },
      max: xMax,
      min: xMin,
      name: '总分',
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
    yAxis: {
      axisLabel: {
        formatter: formatScoreAxisLabel,
      },
      max: yMax,
      min: yMin,
      name: '意图分',
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

function getMobileLineChartConfig(
  data: Array<{ label: string; value: number }>,
): EChartsOption {
  return {
    color: ['#2563eb'],
    grid: {
      bottom: 24,
      containLabel: true,
      left: 4,
      right: 8,
      top: 20,
    },
    series: [
      {
        areaStyle: {
          opacity: 0.1,
        },
        data: data.map((item) => item.value),
        label: {
          color: '#2563eb',
          fontSize: 10,
          show: true,
        },
        lineStyle: {
          width: 3,
        },
        smooth: true,
        symbolSize: 7,
        type: 'line',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        fontSize: 10,
        interval: 0,
      },
      axisTick: {
        show: false,
      },
      data: data.map((item) => item.label),
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

function getMobileRateChartConfig(
  data: Array<{ label: string; value: number }>,
): EChartsOption {
  return {
    color: ['#16a34a'],
    grid: {
      bottom: 24,
      containLabel: true,
      left: 4,
      right: 8,
      top: 18,
    },
    series: [
      {
        data: data.map((item) => item.value),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
        },
        label: {
          color: '#16a34a',
          fontSize: 10,
          formatter: '{c}%',
          position: 'top',
          show: true,
        },
        type: 'bar',
      },
    ],
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) => `${value}%`,
    },
    xAxis: {
      axisLabel: {
        fontSize: 10,
        interval: 0,
      },
      axisTick: {
        show: false,
      },
      data: data.map((item) => item.label),
      type: 'category',
    },
    yAxis: {
      axisLabel: {
        fontSize: 10,
        formatter: '{value}%',
      },
      max: 100,
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

function getMobileSourceChartConfig(
  data: RadarAnalysisSourceStat[],
): EChartsOption {
  const items = data.slice(0, 4).reverse();
  return {
    color: ['#2563eb'],
    grid: {
      bottom: 8,
      containLabel: true,
      left: 4,
      right: 18,
      top: 8,
    },
    series: [
      {
        data: items.map((item) => item.convertedLeads),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
        },
        label: {
          color: '#2563eb',
          fontSize: 10,
          position: 'right',
          show: true,
        },
        type: 'bar',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
    yAxis: {
      axisLabel: {
        fontSize: 10,
        overflow: 'truncate',
        width: 72,
      },
      data: items.map((item) => item.sourceName),
      type: 'category',
    },
  };
}

const mobileChartConfigRefs = {
  getMobileLineChartConfig,
  getMobileRateChartConfig,
  getMobileSourceChartConfig,
};

function goToLeadDetail(leadId: number) {
  const detailBasePath = route.path.includes('/mobile-dashboard')
    ? '/investment/radar/mobile'
    : '/investment/radar';
  router.push(`${detailBasePath}/${leadId}`);
}

async function loadDashboard() {
  loading.value = true;
  loadError.value = '';
  try {
    const [leadResult, opportunityResult, analysisResult] = await Promise.all([
      getRadarLeadList({
        currentPage: 1,
        pageSize: 8,
      }),
      getEffectivePublicOpportunityList({
        currentPage: 1,
        pageSize: 6,
      }),
      getRadarAnalysisSummary(),
    ]);

    leads.value = Array.isArray(leadResult.items) ? leadResult.items : [];
    opportunities.value = Array.isArray(opportunityResult.items)
      ? opportunityResult.items
      : [];
    analysis.value = analysisResult;

    const possibleTaskId = window.sessionStorage.getItem(
      'latest_radar_task_id',
    );
    if (possibleTaskId) {
      try {
        latestTask.value = await getRadarCollectTask(possibleTaskId);
      } catch {
        latestTask.value = null;
      }
    }
  } catch (error) {
    console.error('加载招商看板失败:', error);
    loadError.value = '看板数据加载失败，请检查雷达相关接口是否已接入。';
  } finally {
    loading.value = false;
  }
}

function goToRadarList() {
  router.push(
    route.path.includes('/mobile-dashboard')
      ? '/investment/radar/mobile'
      : '/investment/radar',
  );
}

function goToTasks() {
  router.push(
    route.path.includes('/mobile-dashboard')
      ? '/investment/radar/mobile-tasks'
      : '/investment/radar-tasks',
  );
}

onMounted(() => {
  void loadDashboard();
});
</script>

<template>
  <Page :auto-content-height="!isMobile">
    <div v-if="isMobile" class="radar-dashboard-mobile">
      <div class="radar-mobile-header">
        <div>
          <h2>招商看板</h2>
          <p>汇总潜客、触达进展与公开机会。</p>
        </div>
        <Button type="primary" :loading="loading" @click="loadDashboard">
          刷新
        </Button>
      </div>

      <div class="radar-mobile-actions">
        <Button block @click="goToRadarList">雷达列表</Button>
        <Button block @click="goToTasks">触达任务</Button>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <template v-if="loading">
        <div class="radar-mobile-skeleton">
          <Skeleton active :paragraph="{ rows: 8 }" />
        </div>
      </template>

      <template v-else>
        <section class="radar-mobile-overview">
          <button
            type="button"
            class="mobile-main-metric"
            @click="goToRadarList"
          >
            <span>线索总数</span>
            <strong>{{ summary.totalLeads }}</strong>
            <em>活跃 {{ summary.activeLeads }}</em>
          </button>
          <div class="mobile-mini-metrics">
            <div>
              <span>A级潜客</span>
              <strong>{{ summary.highPriority }}</strong>
            </div>
            <div>
              <span>已触达</span>
              <strong>{{ summary.replied }}</strong>
            </div>
            <div>
              <span>公开机会</span>
              <strong>{{ opportunities.length }}</strong>
            </div>
            <div>
              <span>同步状态</span>
              <strong>{{ latestTaskStatusText }}</strong>
            </div>
          </div>
        </section>

        <section v-if="mobileFunnelSteps.length > 0" class="radar-mobile-panel">
          <div class="radar-mobile-section-head">
            <div>
              <h3>招商进程</h3>
              <p>对应 PC 端招商进程图</p>
            </div>
          </div>
          <DashboardChart
            :chart-data="mobileFunnelSteps"
            :get-options="mobileChartConfigRefs.getMobileLineChartConfig"
            height="190px"
          />
        </section>

        <section v-if="analysis" class="radar-mobile-panel">
          <div class="radar-mobile-section-head">
            <div>
              <h3>转化效率</h3>
              <p>对应 PC 端转化效率图表</p>
            </div>
          </div>
          <DashboardChart
            :chart-data="mobileRateItems"
            :get-options="mobileChartConfigRefs.getMobileRateChartConfig"
            height="190px"
          />
        </section>

        <section v-if="analysis" class="radar-mobile-panel">
          <div class="radar-mobile-section-head">
            <div>
              <h3>关键贡献</h3>
              <p>来源、信号和销售效率摘要</p>
            </div>
          </div>
          <DashboardChart
            v-if="mobileSourceHighlights.length > 0"
            :chart-data="mobileSourceHighlights"
            :get-options="mobileChartConfigRefs.getMobileSourceChartConfig"
            height="180px"
          />
          <div class="mobile-insight-grid">
            <div>
              <span>最佳来源</span>
              <strong>{{
                mobileSourceHighlights[0]?.sourceName || '-'
              }}</strong>
              <em>
                转化 {{ mobileSourceHighlights[0]?.conversionRate ?? 0 }}%
              </em>
            </div>
            <div>
              <span>高效信号</span>
              <strong>{{ mobileSignalHighlights[0]?.eventType || '-' }}</strong>
              <em>带看 {{ mobileSignalHighlights[0]?.visitRate ?? 0 }}%</em>
            </div>
            <div>
              <span>跟进负责人</span>
              <strong>{{ mobileOwnerHighlights[0]?.ownerName || '-' }}</strong>
              <em>触达 {{ mobileOwnerHighlights[0]?.contactRate ?? 0 }}%</em>
            </div>
          </div>
          <div
            v-if="analysis.suggestions.length > 0"
            class="radar-mobile-suggestions"
          >
            <div
              v-for="item in analysis.suggestions"
              :key="item.title"
              class="radar-mobile-suggestion"
            >
              <Tag :color="getSuggestionColor(item.level)">
                {{ item.title }}
              </Tag>
              <p>{{ item.content }}</p>
            </div>
          </div>
        </section>

        <section class="radar-mobile-panel">
          <div class="radar-mobile-section-head">
            <div>
              <h3>优先潜客</h3>
              <p>按评分排序的重点跟进对象</p>
            </div>
            <Button size="small" type="link" @click="goToRadarList">
              全部
            </Button>
          </div>
          <div v-if="leads.length > 0" class="mobile-rank-list">
            <button
              v-for="(lead, index) in leads.slice(0, 5)"
              :key="lead.leadId"
              class="mobile-rank-item"
              type="button"
              @click="goToLeadDetail(lead.leadId)"
            >
              <span class="mobile-rank-index">{{ index + 1 }}</span>
              <div>
                <strong>{{ lead.enterpriseName || '-' }}</strong>
                <small>
                  {{ lead.parkName || '-' }} / {{ getStageLabel(lead.stage) }}
                </small>
              </div>
              <Tag :color="getPriorityColor(lead.priorityLevel)">
                {{ lead.priorityLevel || '-' }}级
              </Tag>
            </button>
          </div>
          <Empty v-else description="暂无优先潜客" />
        </section>

        <section class="radar-mobile-panel">
          <div class="radar-mobile-section-head">
            <div>
              <h3>最新公开机会</h3>
              <p>需求和房源供给的最新入口</p>
            </div>
          </div>
          <div v-if="opportunities.length > 0" class="mobile-opportunity-list">
            <article
              v-for="item in opportunities.slice(0, 4)"
              :key="item.opportunityId"
              class="mobile-opportunity-item"
            >
              <div>
                <strong>{{ item.title || '-' }}</strong>
                <small>
                  {{ getOpportunityLocation(item) }} /
                  {{ getOpportunityArea(item) }}
                </small>
              </div>
              <Tag color="blue">
                {{ getOpportunityTypeLabel(item.opportunityType) }}
              </Tag>
            </article>
          </div>
          <Empty v-else description="暂无公开机会" />
        </section>
      </template>
    </div>

    <div v-else class="radar-dashboard space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold">招商看板</div>
          <div class="text-text-secondary text-sm">
            汇总招商线索、触达进展与公开机会，辅助判断当前招商跟进重点。
          </div>
        </div>
        <Space>
          <Button @click="goToRadarList">返回雷达列表</Button>
          <Button @click="goToTasks">触达任务</Button>
          <Button type="primary" @click="loadDashboard">刷新数据</Button>
        </Space>
      </div>

      <Alert v-if="loadError" :message="loadError" show-icon type="warning" />

      <template v-if="loading">
        <Row :gutter="[16, 16]">
          <Col v-for="item in 4" :key="item" :lg="6" :md="12" :sm="12" :xs="24">
            <Card>
              <Skeleton active :paragraph="{ rows: 4 }" />
            </Card>
          </Col>
        </Row>
      </template>

      <template v-else>
        <Row class="radar-stat-card-grid" :gutter="[12, 12]">
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="线索总数" :value="summary.totalLeads" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="活跃线索" :value="summary.activeLeads" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="A级潜客" :value="summary.highPriority" />
            </Card>
          </Col>
          <Col :lg="6" :md="12" :sm="12" :xs="24">
            <Card class="radar-stat-card">
              <Statistic title="已触达" :value="summary.replied" />
            </Card>
          </Col>
        </Row>

        <Row :gutter="[16, 16]">
          <Col :lg="12" :md="24" :sm="24" :xs="24">
            <Card title="招商进程">
              <DashboardChart
                :chart-data="processLineChartData"
                :get-options="getLineChartConfig"
                height="300px"
              />
            </Card>
          </Col>
          <Col :lg="12" :md="24" :sm="24" :xs="24">
            <Card title="转化效率">
              <DashboardChart
                :chart-data="conversionLineChartData"
                :get-options="getRateLineChartConfig"
                height="300px"
              />
            </Card>
          </Col>
          <Col :lg="12" :md="24" :sm="24" :xs="24">
            <Card title="来源贡献">
              <DashboardChart
                :chart-data="sourceBarChartData"
                :get-options="getSourceBarChartConfig"
                height="320px"
              />
            </Card>
          </Col>
          <Col :lg="12" :md="24" :sm="24" :xs="24">
            <Card title="潜客评分分布">
              <DashboardChart
                :chart-data="scoreScatterChartData"
                :get-options="getScoreScatterChartConfig"
                height="320px"
                placeholder="暂无评分数据"
              />
            </Card>
          </Col>
        </Row>

        <Card v-if="analysis" title="策略建议">
          <div
            v-if="analysis.suggestions.length > 0"
            class="radar-suggestion-list"
          >
            <div
              v-for="item in analysis.suggestions"
              :key="item.title"
              class="radar-suggestion-item"
            >
              <Tag :color="getSuggestionColor(item.level)">
                {{ item.title }}
              </Tag>
              <span>{{ item.content }}</span>
            </div>
          </div>
          <Empty v-else description="暂无策略建议" />
        </Card>

        <Card title="最新公开机会">
          <div v-if="opportunities.length > 0" class="radar-opportunity-list">
            <article
              v-for="item in opportunities"
              :key="item.opportunityId"
              class="radar-opportunity-item"
            >
              <div class="radar-opportunity-content">
                <div class="radar-opportunity-title">
                  {{ item.title || '-' }}
                </div>
                <div class="radar-opportunity-meta">
                  {{ getOpportunityLocation(item) }} ·
                  {{ getOpportunityArea(item) }} ·
                  {{ item.sourceSite || '-' }}
                </div>
              </div>
              <Tag class="radar-opportunity-tag" color="blue">
                {{ getOpportunityTypeLabel(item.opportunityType) }}
              </Tag>
            </article>
          </div>
          <Empty v-else description="暂无公开机会" />
        </Card>
      </template>
    </div>
  </Page>
</template>

<style scoped>
.radar-dashboard-mobile {
  box-sizing: border-box;
  min-height: 100%;
  padding: 10px 8px calc(88px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .radar-dashboard-mobile {
  background: #1a1a1a;
}

.radar-mobile-header,
.radar-mobile-panel,
.radar-mobile-skeleton {
  background: var(--ant-color-bg-container);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.radar-mobile-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
}

.radar-mobile-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  color: var(--ant-color-text);
}

.radar-mobile-header p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-skeleton {
  padding: 12px;
}

.radar-mobile-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr);
  gap: 8px;
  margin-top: 8px;
}

.mobile-main-metric {
  min-width: 0;
  padding: 14px;
  text-align: left;
  cursor: pointer;
  background: linear-gradient(135deg, #1f2937 0%, #2563eb 100%);
  border: 0;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgb(37 99 235 / 20%);
}

.mobile-main-metric span,
.mobile-main-metric em {
  display: block;
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
  color: rgb(255 255 255 / 72%);
}

.mobile-main-metric strong {
  display: block;
  margin: 6px 0;
  font-size: 34px;
  font-weight: 760;
  line-height: 38px;
  color: #fff;
}

.mobile-mini-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mobile-mini-metrics div,
.mobile-insight-grid div {
  min-width: 0;
  padding: 10px;
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

.mobile-mini-metrics span,
.mobile-insight-grid span,
.mobile-insight-grid em {
  display: block;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-mini-metrics strong,
.mobile-insight-grid strong {
  display: block;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-mini-metrics strong {
  margin-top: 2px;
}

.radar-mobile-panel {
  padding: 12px;
  margin-top: 8px;
}

.radar-mobile-section-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.radar-mobile-section-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  color: var(--ant-color-text);
}

.radar-mobile-section-head p {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.mobile-insight-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.mobile-insight-grid div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 64px;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
}

.mobile-insight-grid strong {
  font-size: 13px;
  line-height: 20px;
}

.mobile-insight-grid em {
  text-align: right;
}

.radar-mobile-error {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-error);
  word-break: break-word;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card {
  display: block;
  width: 100%;
  padding: 12px;
  color: inherit;
  text-align: left;
  background: var(--ant-color-fill-tertiary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

button.radar-mobile-card {
  cursor: pointer;
}

.radar-mobile-card-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.radar-mobile-card-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  color: var(--ant-color-text);
  word-break: break-word;
}

.radar-mobile-card-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-card-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-suggestions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.radar-mobile-suggestion {
  padding-top: 8px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.radar-mobile-suggestion p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.mobile-rank-list,
.mobile-opportunity-list {
  display: grid;
  gap: 8px;
}

.mobile-rank-item,
.mobile-opportunity-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 10px 0;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--ant-color-border-secondary);
}

.mobile-opportunity-item {
  grid-template-columns: minmax(0, 1fr) auto;
}

.mobile-rank-item:last-child,
.mobile-opportunity-item:last-child {
  border-bottom: 0;
}

.mobile-rank-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ant-color-primary);
  background: var(--ant-color-primary-bg);
  border-radius: 999px;
}

.mobile-rank-item strong,
.mobile-opportunity-item strong,
.mobile-rank-item small,
.mobile-opportunity-item small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-rank-item strong,
.mobile-opportunity-item strong {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
}

.mobile-rank-item small,
.mobile-opportunity-item small {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.radar-stat-card-grid {
  margin: 0 !important;
}

.radar-stat-card {
  height: 100%;
}

.radar-stat-card :deep(.ant-card-body) {
  padding: 16px 18px;
}

.radar-stat-card :deep(.ant-statistic-title) {
  margin-bottom: 4px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-stat-card :deep(.ant-statistic-content) {
  font-size: 24px;
  line-height: 32px;
  color: var(--ant-color-text);
}

.radar-suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-suggestion-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 14px;
  line-height: 22px;
  color: var(--ant-color-text);
}

.radar-chart {
  position: relative;
  width: 100%;
}

.radar-chart-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--ant-color-text-tertiary);
  pointer-events: none;
  background: color-mix(
    in srgb,
    var(--ant-color-bg-container) 82%,
    transparent
  );
}

.radar-sync-status {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 8px;
}

.radar-sync-status > div {
  min-width: 0;
}

.radar-sync-status span {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.radar-sync-status strong {
  display: block;
  max-width: 180px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-opportunity-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.radar-opportunity-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
  padding: 12px;
  background: var(--ant-color-fill-tertiary);
  border: 1px solid var(--ant-color-border-secondary);
  border-radius: 8px;
}

.radar-opportunity-content {
  min-width: 0;
}

.radar-opportunity-title {
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  word-break: break-word;
  -webkit-box-orient: vertical;
}

.radar-opportunity-meta {
  margin-top: 4px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-opportunity-tag {
  flex: none;
}

@media (max-width: 1199px) {
  .radar-opportunity-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .radar-opportunity-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
