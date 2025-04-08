<script lang="ts" setup>
import type { AnalysisOverviewItem } from '@vben/common-ui';
import type { TabOption } from '@vben/types';

import {
  AnalysisChartCard,
  AnalysisChartsTabs,
  AnalysisOverview,
} from '@vben/common-ui';
import {
  SvgBellIcon,
  SvgCakeIcon,
  SvgCardIcon,
  SvgDownloadIcon,
} from '@vben/icons';

import AnalyticsExpenseSales from './analytics-expense-sales.vue';
import AnalyticsIncomeData from './analytics-income-data.vue';
import AnalyticsIncomeSource from './analytics-income-source.vue';
import AnalyticsTrends from './analytics-trends.vue';
import AnalyticsVisitsData from './analytics-visits-data.vue';
import AnalyticsVisitsSales from './analytics-visits-sales.vue';
import AnalyticsVisitsSource from './analytics-visits-source.vue';
import AnalyticsVisits from './analytics-visits.vue';

const overviewItems: AnalysisOverviewItem[] = [
  {
    icon: SvgCardIcon,
    title: '收入总额',
    totalTitle: '年度收入',
    totalValue: 120_000,
    value: 2000,
  },
  {
    icon: SvgCakeIcon,
    title: '支出总额',
    totalTitle: '年度支出',
    totalValue: 500_000,
    value: 20_000,
  },
  {
    icon: SvgDownloadIcon,
    title: '本月收入',
    totalTitle: '环比增长',
    totalValue: 120_000,
    value: 8000,
  },
  {
    icon: SvgBellIcon,
    title: '本月支出',
    totalTitle: '环比增长',
    totalValue: 50_000,
    value: 5000,
  },
];

const chartTabs: TabOption[] = [
  {
    label: '日收支情况',
    value: 'trends',
  },
  {
    label: '月收支情况',
    value: 'visits',
  },
];
</script>

<template>
  <div class="p-5">
    <AnalysisOverview :items="overviewItems" />
    <AnalysisChartsTabs :tabs="chartTabs" class="mt-5">
      <template #trends>
        <AnalyticsTrends />
      </template>
      <template #visits>
        <AnalyticsVisits />
      </template>
    </AnalysisChartsTabs>

    <div class="mt-5 w-full md:flex md:flex-wrap md:justify-between">
      <!-- 收入相关图表 -->
      <AnalysisChartCard class="mt-5 md:w-[32%]" title="收入趋势">
        <AnalyticsIncomeData />
      </AnalysisChartCard>
      <AnalysisChartCard class="mt-5 md:w-[32%]" title="收入环比">
        <AnalyticsIncomeSource />
      </AnalysisChartCard>
      <AnalysisChartCard class="mt-5 md:w-[32%]" title="收入占比">
        <AnalyticsVisitsSales />
      </AnalysisChartCard>

      <!-- 支出相关图表 -->
      <AnalysisChartCard class="mt-5 md:w-[32%]" title="支出趋势">
        <AnalyticsVisitsData />
      </AnalysisChartCard>
      <AnalysisChartCard class="mt-5 md:w-[32%]" title="支出环比">
        <AnalyticsVisitsSource />
      </AnalysisChartCard>
      <AnalysisChartCard class="mt-5 md:w-[32%]" title="支出占比">
        <AnalyticsExpenseSales />
      </AnalysisChartCard>
    </div>
  </div>
</template>
