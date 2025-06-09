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

// 导入重构后的业务组件
import {
  AnalyticsExpenseData,
  AnalyticsExpenseSales,
  AnalyticsExpenseSource,
  AnalyticsIncomeData,
  AnalyticsIncomeSales,
  AnalyticsIncomeSource,
  AnalyticsMonthly,
  AnalyticsParkElectricity,
  AnalyticsTrends,
} from './components';

// 重构数据结构，使其更具可读性
const analyticsData = ref<{
  daily: {
    expense: number[];
    income: number[];
  };
  monthly: {
    expense: number[];
    income: number[];
  };
}>({
  daily: { expense: [], income: [] },
  monthly: { expense: [], income: [] },
});

// 获取数据
onMounted(async () => {
  try {
    // 获取月度数据
    const monthlyResult = await getAnalyticsData({ type: 'months' });
    analyticsData.value.monthly = {
      expense: monthlyResult.expenseDatamonths || [],
      income: monthlyResult.incomeDatamonths || [],
    };

    // 获取每日数据
    const dailyResult = await getAnalyticsData({ type: 'days' });
    analyticsData.value.daily = {
      expense: dailyResult.expenseData || [],
      income: dailyResult.incomeData || [],
    };
  } catch (error) {
    console.error('获取数据失败:', error);
  }
});

// 计算增长率，代码更健壮
const calculateGrowth = (data: number[] = []) => {
  if (data.length < 2) {
    return 0;
  }
  const current = data[data.length - 1];
  const previous = data[data.length - 2];
  if (previous === 0) {
    // 当上一个值为0时，如果当前值大于0，可以认为增长率为100%或无穷大
    // 这里为简化处理，返回100；如果当前值也为0，则增长为0
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
};

// --- 提取计算属性以提高可读性 ---

// 本月总收入 (基于每日数据累加)
const totalMonthlyIncome = computed(() =>
  analyticsData.value.daily.income.reduce((sum, curr) => sum + Number(curr), 0),
);

// 本月总支出 (基于每日数据累加)
const totalMonthlyExpense = computed(() =>
  analyticsData.value.daily.expense.reduce(
    (sum, curr) => sum + Number(curr),
    0,
  ),
);

// 年度总收入 (基于每月数据累加)
const totalAnnualIncome = computed(() =>
  analyticsData.value.monthly.income.reduce(
    (sum, curr) => sum + Number(curr),
    0,
  ),
);

// 年度总支出 (基于每月数据累加)
const totalAnnualExpense = computed(() =>
  analyticsData.value.monthly.expense.reduce(
    (sum, curr) => sum + Number(curr),
    0,
  ),
);

// 最新日收入
const latestDailyIncome = computed(() => {
  const { income } = analyticsData.value.daily;
  return income.length > 0 ? income[income.length - 1] : 0;
});

// 最新日支出
const latestDailyExpense = computed(() => {
  const { expense } = analyticsData.value.daily;
  return expense.length > 0 ? expense[expense.length - 1] : 0;
});

// 日收入环比增长
const dailyIncomeGrowth = computed(() =>
  calculateGrowth(analyticsData.value.daily.income),
);

// 日支出环比增长
const dailyExpenseGrowth = computed(() =>
  calculateGrowth(analyticsData.value.daily.expense),
);

// 更新概览项以提高清晰度和一致性
const overviewItems = computed<AnalysisOverviewItem[]>(() => [
  {
    icon: SvgCardIcon,
    title: '本月总收入',
    totalTitle: '年度总收入',
    totalValue: totalAnnualIncome.value,
    value: totalMonthlyIncome.value,
  },
  {
    icon: SvgCakeIcon,
    title: '本月总支出',
    totalTitle: '年度总支出',
    totalValue: totalAnnualExpense.value,
    value: totalMonthlyExpense.value,
  },
  {
    icon: SvgDownloadIcon,
    title: '最新日收入',
    totalTitle: '日环比增长',
    totalValue: dailyIncomeGrowth.value,
    value: latestDailyIncome.value,
  },
  {
    icon: SvgBellIcon,
    title: '最新日支出',
    totalTitle: '日环比增长',
    totalValue: dailyExpenseGrowth.value,
    value: latestDailyExpense.value,
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

    <AnalysisChartCard class="mt-5 w-full" title="各园区实收电度数和电费金额">
      <AnalyticsParkElectricity />
    </AnalysisChartCard>
  </div>
</template>
