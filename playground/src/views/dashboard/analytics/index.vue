<script lang="ts" setup>
import type { AnalysisOverviewItem } from '@vben/common-ui';
import type { TabOption } from '@vben/types';

import { computed, onMounted, ref } from 'vue';

// UI 组件
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

import { getAnalyticsData } from '#/api/analytics';

// 业务组件
import AnalyticsExpenseData from './analytics-expense-data.vue';
import AnalyticsExpenseSales from './analytics-expense-sales.vue';
import AnalyticsExpenseSource from './analytics-expense-source.vue';
import AnalyticsIncomeData from './analytics-income-data.vue';
import AnalyticsIncomeSales from './analytics-income-sales.vue';
import AnalyticsIncomeSource from './analytics-income-source.vue';
import AnalyticsMonthly from './analytics-monthly.vue'; // 重命名组件
import AnalyticsTrends from './analytics-trends.vue';

// 数据初始化
const analyticsData = ref({
  monthData: {
    expenseData: [],
    incomeData: [],
  },
  yearData: {
    expenseDatamonths: [],
    incomeDatamonths: [],
  },
});

// 获取数据
onMounted(async () => {
  try {
    const yearResult = await getAnalyticsData({ type: 'months' });
    analyticsData.value.yearData = yearResult;

    const monthResult = await getAnalyticsData({ type: 'days' });
    analyticsData.value.monthData = monthResult;
  } catch (error) {
    console.error('获取数据失败:', error);
  }
});

// 计算环比增长率
const calculateGrowth = (data: number[] = []) => {
  if (data.length === 0) return 0;
  const currentMonth = data[data.length - 1] || 0;
  const lastMonth = data[data.length - 2] || 0;
  return lastMonth
    ? Math.round(((currentMonth - lastMonth) / lastMonth) * 100)
    : 0;
};

const overviewItems = computed<AnalysisOverviewItem[]>(() => [
  {
    icon: SvgCardIcon,
    title: '收入总额',
    totalTitle: '年度收入',
    totalValue: analyticsData.value.yearData.incomeDatamonths.reduce(
      (sum, curr) => sum + Number(curr),
      0,
    ),
    value: analyticsData.value.monthData.incomeData.reduce(
      (sum, curr) => sum + Number(curr),
      0,
    ),
  },
  {
    icon: SvgCakeIcon,
    title: '支出总额',
    totalTitle: '年度支出',
    totalValue: analyticsData.value.yearData.expenseDatamonths.reduce(
      (sum, curr) => sum + Number(curr),
      0,
    ),
    value: analyticsData.value.monthData.expenseData.reduce(
      (sum, curr) => sum + Number(curr),
      0,
    ),
  },
  {
    icon: SvgDownloadIcon,
    title: '本月收入',
    totalTitle: '环比增长',
    totalValue:
      analyticsData.value.monthData.incomeData[
        analyticsData.value.monthData.incomeData.length - 1
      ] || 0,
    value: calculateGrowth(analyticsData.value.monthData.incomeData),
  },
  {
    icon: SvgBellIcon,
    title: '本月支出',
    totalTitle: '环比增长',
    totalValue:
      analyticsData.value.monthData.expenseData[
        analyticsData.value.monthData.expenseData.length - 1
      ] || 0,
    value: calculateGrowth(analyticsData.value.monthData.expenseData),
  },
]);

const chartTabs: TabOption[] = [
  {
    label: '日收支情况',
    value: 'trends',
  },
  {
    label: '月收支情况', // 更新标签文案
    value: 'monthly', // 更新值
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
      <template #monthly>
        <!-- 更新插槽名 -->
        <AnalyticsMonthly />
      </template>
    </AnalysisChartsTabs>

    <div class="mt-5 w-full md:flex md:flex-wrap">
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="支出趋势"
      >
        <AnalyticsExpenseData />
      </AnalysisChartCard>
      <AnalysisChartCard class="mt-5 md:mr-4 md:w-[32%]" title="支出环比">
        <AnalyticsExpenseSource />
      </AnalysisChartCard>
      <AnalysisChartCard class="mt-5 md:w-[32%]" title="支出占比">
        <AnalyticsExpenseSales />
      </AnalysisChartCard>

      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="收入趋势"
      >
        <AnalyticsIncomeData />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="收入环比"
      >
        <AnalyticsIncomeSource />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="收入占比"
      >
        <AnalyticsIncomeSales />
      </AnalysisChartCard>
    </div>
  </div>
</template>
