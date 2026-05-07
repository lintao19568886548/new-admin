<script lang="ts" setup>
import { h, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AnalysisChartCard } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { notification, Select } from 'ant-design-vue';

import {
  getAnalyticsData,
  getAnalyticsMonth,
  getAnalyticsParkElectricity,
  getAnalyticsTotal,
  getAnalyticsTrend,
} from '#/api/analytics';
import { getParkList } from '#/api/park';
import {
  getPendingReimbursementCount,
  getReimbursementList,
} from '#/api/reimbursement';

import {
  AnalyticsContract,
  AnalyticsCount,
  AnalyticsCustomer,
  AnalyticsEnergy,
  AnalyticsInvestment,
  AnalyticsRevenue,
  AnalyticsWorkOrder,
} from './components';

const userStore = useUserStore();
const router = useRouter();

const isMobile = ref(false);
const investmentSelectedParkId = ref(-1);
const contractSelectedParkId = ref(-1);
const revenueSelectedParkId = ref(-1);
const parkOptions = ref<Array<{ label: string; value: number }>>([
  { label: '全部', value: -1 },
]);

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

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
const REIMBURSEMENT_NOTIFY_THRESHOLD = 50_000;
const REIMBURSEMENT_PENDING_PAGE_SIZE = 200;

async function fetchParkOptions() {
  try {
    const parks = await getParkList();
    parkOptions.value = [
      { label: '全部', value: -1 },
      ...(Array.isArray(parks)
        ? parks.map((park: { parkId: number; parkName: string }) => ({
            label: park.parkName,
            value: park.parkId,
          }))
        : []),
    ];
  } catch (error) {
    console.error('获取营收统计园区列表失败:', error);
  }
}

async function getOverThresholdPendingCount() {
  const first = await getReimbursementList({
    pageNo: 1,
    pageSize: REIMBURSEMENT_PENDING_PAGE_SIZE,
    status: 0,
  });
  let count = (first.items || []).filter(
    (it: any) => Number(it.amount) > REIMBURSEMENT_NOTIFY_THRESHOLD,
  ).length;

  const total = first.total || 0;
  const pages = Math.ceil(total / REIMBURSEMENT_PENDING_PAGE_SIZE);
  for (let page = 2; page <= pages; page++) {
    const next = await getReimbursementList({
      pageNo: page,
      pageSize: REIMBURSEMENT_PENDING_PAGE_SIZE,
      status: 0,
    });
    count += (next.items || []).filter(
      (it: any) => Number(it.amount) > REIMBURSEMENT_NOTIFY_THRESHOLD,
    ).length;
  }

  return count;
}

onMounted(async () => {
  handleResize();
  window.addEventListener('resize', handleResize);
  fetchParkOptions();
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

    if ((userStore.userInfo?.reimbursementAuth || 0) > 0) {
      const pending = await getPendingReimbursementCount();
      const rates = userStore.userInfo?.rates;
      const hasUnlimitedRates =
        rates === null || rates === undefined || rates < 0;
      let notifyCount = pending.count || 0;
      if (hasUnlimitedRates && notifyCount > 0) {
        notifyCount = await getOverThresholdPendingCount();
      }

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
          description: hasUnlimitedRates
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
</script>

<template>
  <div class="p-5">
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <AnalysisChartCard title="厂房租赁">
        <template #extra>
          <div class="w-full sm:w-auto">
            <Select
              v-model:value="investmentSelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsInvestment :park-id="investmentSelectedParkId" />
      </AnalysisChartCard>
      <AnalysisChartCard title="合同总览">
        <template #extra>
          <div class="w-full sm:w-auto">
            <Select
              v-model:value="contractSelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsContract :park-id="contractSelectedParkId" />
      </AnalysisChartCard>
      <AnalysisChartCard title="客户总览">
        <AnalyticsCustomer />
      </AnalysisChartCard>
      <AnalysisChartCard title="营收统计">
        <template #extra>
          <div class="w-full sm:w-auto">
            <Select
              v-model:value="revenueSelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsRevenue :park-id="revenueSelectedParkId" />
      </AnalysisChartCard>
      <AnalysisChartCard title="能源消耗">
        <AnalyticsEnergy />
      </AnalysisChartCard>
      <AnalysisChartCard title="维修工单">
        <AnalyticsWorkOrder />
      </AnalysisChartCard>
      <AnalysisChartCard title="表计数量统计">
        <AnalyticsCount />
      </AnalysisChartCard>
    </div>
  </div>
</template>
