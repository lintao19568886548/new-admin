<script lang="ts" setup>
import type { AnalysisOverviewItem } from '@vben/common-ui';
import type { TabOption } from '@vben/types';

import { computed, h, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

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
import { useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';

import {
  getAnalyticsData,
  getAnalyticsMonth,
  getAnalyticsParkElectricity,
  getAnalyticsTotal,
  getAnalyticsTrend,
} from '#/api/analytics';
import {
  getPendingReimbursementCount,
  getReimbursementList,
} from '#/api/reimbursement';
import { CHAIRMAN_ROLE_NAMES, REIMBURSEMENT_NOTIFY_THRESHOLD } from '#/config';

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

const userStore = useUserStore();
const router = useRouter();

const isMobile = ref(false);

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

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
const trendData = ref({});
const monthCompareData = ref({});
const totalData = ref({});
const parkElectricityData = ref([]);

// 求和辅助函数
const sumData = (data: number[] = []) =>
  data.reduce((sum, curr) => sum + Number(curr), 0);

// 获取数据
onMounted(async () => {
  handleResize();
  window.addEventListener('resize', handleResize);
  try {
    const [
      yearResult,
      monthResult,
      trendResult,
      monthCompareResult,
      totalResult,
      parkElectricityResult,
    ] = await Promise.all([
      getAnalyticsData({ type: 'months' }),
      getAnalyticsData({ type: 'days' }),
      getAnalyticsTrend(),
      getAnalyticsMonth(),
      getAnalyticsTotal(),
      getAnalyticsParkElectricity(),
    ]);

    analyticsData.value.yearData = yearResult;
    analyticsData.value.monthData = monthResult;
    trendData.value = trendResult;
    monthCompareData.value = monthCompareResult;
    totalData.value = totalResult;
    parkElectricityData.value = parkElectricityResult;

    // 检查用户是否有报销审核权限
    if ((userStore.userInfo?.reimbursementAuth || 0) > 0) {
      const pageSize = 200;
      const first = await getReimbursementList({
        pageNo: 1,
        pageSize,
        status: 0,
      });
      let count = (first.items || []).filter(
        (it: any) => Number(it.amount) > REIMBURSEMENT_NOTIFY_THRESHOLD,
      ).length;
      const total = first.total || 0;
      const pages = Math.ceil(total / pageSize);
      for (let page = 2; page <= pages; page++) {
        const next = await getReimbursementList({
          pageNo: page,
          pageSize,
          status: 0,
        });
        count += (next.items || []).filter(
          (it: any) => Number(it.amount) > REIMBURSEMENT_NOTIFY_THRESHOLD,
        ).length;
      }
      const roles = userStore.userInfo?.roles ?? [];
      const isChairman = CHAIRMAN_ROLE_NAMES.some((role) =>
        roles.includes(role),
      );
      const pending = await getPendingReimbursementCount();
      const notifyCount = isChairman ? count : pending.count || 0;
      if (notifyCount > 0) {
        notification.info({
          btn: h(
            'a',
            {
              onClick: () => {
                const path = isMobile.value
                  ? '/reimbursement/mobile-audit'
                  : '/reimbursement/audit';
                router.push(path);
                notification.close('reimbursement-notification');
              },
              style: {
                color: '#1890ff',
                cursor: 'pointer',
                marginLeft: '8px',
              },
            },
            '去处理',
          ),
          description: isChairman
            ? `您有 ${notifyCount} 条金额>${REIMBURSEMENT_NOTIFY_THRESHOLD}的报销申请待处理`
            : `您有 ${notifyCount} 条报销申请待处理`,
          duration: null,
          key: 'reimbursement-notification',
          message: '待办提醒',
        });
      }
    }
  } catch (error) {
    console.error('获取数据失败:', error);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 计算环比增长率

const overviewItems = computed<AnalysisOverviewItem[]>(() => [
  {
    icon: SvgCardIcon,
    title: '收入总额',
    totalTitle: '年度收入',
    totalValue: sumData(analyticsData.value.yearData.incomeDatamonths),
    value: sumData(analyticsData.value.yearData.incomeDatamonths),
  },
  {
    icon: SvgCakeIcon,
    title: '支出总额',
    totalTitle: '年度支出',
    totalValue: sumData(analyticsData.value.yearData.expenseDatamonths),
    value: sumData(analyticsData.value.yearData.expenseDatamonths),
  },
  {
    icon: SvgDownloadIcon,
    title: '收入月环比',
    totalTitle: '本月总收入',
    totalValue: sumData(analyticsData.value.monthData.incomeData),
    value: sumData(analyticsData.value.monthData.incomeData),
  },
  {
    icon: SvgBellIcon,
    title: '支出月环比',
    totalTitle: '本月总支出',
    totalValue: sumData(analyticsData.value.monthData.expenseData),
    value: sumData(analyticsData.value.monthData.expenseData),
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
        <AnalyticsTrends :data="analyticsData.monthData" />
      </template>
      <template #monthly>
        <!-- 更新插槽名 -->
        <AnalyticsMonthly :data="analyticsData.yearData" />
      </template>
    </AnalysisChartsTabs>

    <div class="mt-5 w-full md:flex md:flex-wrap">
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="支出趋势"
      >
        <AnalyticsExpenseData :data="trendData" />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="支出环比"
      >
        <AnalyticsExpenseSource :data="monthCompareData" />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="支出占比"
      >
        <AnalyticsExpenseSales :data="totalData" />
      </AnalysisChartCard>

      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="收入趋势"
      >
        <AnalyticsIncomeData :data="trendData" />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="收入环比"
      >
        <AnalyticsIncomeSource :data="monthCompareData" />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mr-4 md:mt-0 md:w-[32%]"
        title="收入占比"
      >
        <AnalyticsIncomeSales :data="totalData" />
      </AnalysisChartCard>
    </div>

    <AnalysisChartCard class="mt-5 w-full" title="各园区实收电度数和电费金额">
      <AnalyticsParkElectricity :data="parkElectricityData" />
    </AnalysisChartCard>
  </div>
</template>
