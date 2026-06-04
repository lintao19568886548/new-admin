<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { ParkOption, ParkOptionValue } from './components/parkOptions';

import { computed, h, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AnalysisChartCard } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { DatePicker, notification, Select } from 'ant-design-vue';
import dayjs from 'dayjs';

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
} from './components';
import { allParkOption } from './components/parkOptions';

const userStore = useUserStore();
const router = useRouter();

const isMobile = ref(false);
const investmentSelectedParkId = ref<ParkOptionValue>('all');
const contractSelectedParkId = ref<ParkOptionValue>('all');
const customerSelectedParkId = ref<ParkOptionValue>('all');
const revenueSelectedParkId = ref<ParkOptionValue>('all');
const revenueSelectedMonth = ref<Dayjs>(dayjs());
const energySelectedParkId = ref<ParkOptionValue>('all');
const countSelectedParkId = ref<ParkOptionValue>('all');
const parkOptions = ref<ParkOption[]>([allParkOption]);
const revenueSelectedMonthText = computed(() =>
  revenueSelectedMonth.value.format('YYYY-MM'),
);

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

const REIMBURSEMENT_NOTIFY_THRESHOLD = 50_000;
const REIMBURSEMENT_PENDING_PAGE_SIZE = 200;

async function fetchParkOptions() {
  try {
    const parks = await getParkList();
    parkOptions.value = [
      allParkOption,
      ...(Array.isArray(parks)
        ? parks.map((park: { parkId: number; parkName: string }) => ({
            label: park.parkName,
            value: park.parkId,
          }))
        : []),
    ];
  } catch (error) {
    console.error('获取总览园区列表失败:', error);
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
      <AnalysisChartCard title="营收统计">
        <template #extra>
          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <DatePicker
              v-model:value="revenueSelectedMonth"
              :allow-clear="false"
              class="w-full sm:w-[150px]"
              format="YYYY年M月"
              picker="month"
              size="middle"
            />
            <Select
              v-model:value="revenueSelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsRevenue
          :month="revenueSelectedMonthText"
          :park-id="revenueSelectedParkId"
        />
      </AnalysisChartCard>
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
      <AnalysisChartCard title="招商总览">
        <template #extra>
          <div class="w-full sm:w-auto">
            <Select
              v-model:value="customerSelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsCustomer :park-id="customerSelectedParkId" />
      </AnalysisChartCard>

      <AnalysisChartCard title="能源消耗">
        <template #extra>
          <div class="w-full sm:w-auto">
            <Select
              v-model:value="energySelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsEnergy :park-id="energySelectedParkId" />
      </AnalysisChartCard>
      <!--
      <AnalysisChartCard title="维护工单">
        <template #extra>
          <div class="w-full sm:w-auto">
            <Select
              v-model:value="workOrderSelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsWorkOrder :park-id="workOrderSelectedParkId" />
      </AnalysisChartCard>
      -->
      <AnalysisChartCard title="表计数量统计">
        <template #extra>
          <div class="w-full sm:w-auto">
            <Select
              v-model:value="countSelectedParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
          </div>
        </template>
        <AnalyticsCount :park-id="countSelectedParkId" />
      </AnalysisChartCard>
    </div>
  </div>
</template>
