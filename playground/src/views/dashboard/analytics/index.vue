<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { ParkOption, ParkOptionValue } from './components/parkOptions';

import { computed, h, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AnalysisChartCard } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, DatePicker, notification, Select } from 'ant-design-vue';
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

type DashboardDateRange = [Dayjs, Dayjs];

interface DashboardModuleFilter {
  appliedDates: DashboardDateRange;
  appliedParkId: ParkOptionValue;
  draftDates: DashboardDateRange;
  draftParkId: ParkOptionValue;
}

function createDefaultDateRange(): DashboardDateRange {
  const today = dayjs();
  return [today.startOf('month'), today];
}

function cloneDateRange(range: DashboardDateRange): DashboardDateRange {
  return [range[0], range[1]];
}

function normalizeDateRange(range: DashboardDateRange): DashboardDateRange {
  if (Array.isArray(range) && range[0] && range[1]) {
    const [start, end] = range;
    return start.isAfter(end) ? [end, start] : [start, end];
  }

  return createDefaultDateRange();
}

function createDashboardModuleFilter(): DashboardModuleFilter {
  const defaultDates = createDefaultDateRange();
  return reactive({
    appliedDates: cloneDateRange(defaultDates),
    appliedParkId: 'all',
    draftDates: cloneDateRange(defaultDates),
    draftParkId: 'all',
  }) as DashboardModuleFilter;
}

function applyDashboardFilter(filter: DashboardModuleFilter) {
  filter.appliedDates = normalizeDateRange(filter.draftDates);
  filter.draftDates = cloneDateRange(filter.appliedDates);
  filter.appliedParkId = filter.draftParkId;
}

function disableFutureDate(current: Dayjs) {
  return current.isAfter(dayjs(), 'day');
}

function normalizeDraftDate(value: unknown) {
  if (dayjs.isDayjs(value)) {
    return value.isAfter(dayjs(), 'day') ? dayjs() : value;
  }

  const parsedDate = dayjs(String(value || ''));
  if (!parsedDate.isValid()) {
    return null;
  }

  return parsedDate.isAfter(dayjs(), 'day') ? dayjs() : parsedDate;
}

function updateDraftStartDate(filter: DashboardModuleFilter, value: unknown) {
  const nextStartDate = normalizeDraftDate(value);
  if (!nextStartDate) {
    return;
  }

  const nextEndDate = filter.draftDates[1].isBefore(nextStartDate, 'day')
    ? nextStartDate
    : filter.draftDates[1];
  filter.draftDates = [nextStartDate, nextEndDate];
}

function updateDraftEndDate(filter: DashboardModuleFilter, value: unknown) {
  const nextEndDate = normalizeDraftDate(value);
  if (!nextEndDate) {
    return;
  }

  filter.draftDates = [
    filter.draftDates[0],
    nextEndDate.isBefore(filter.draftDates[0], 'day')
      ? filter.draftDates[0]
      : nextEndDate,
  ];
}

function disableEndDate(current: Dayjs, filter: DashboardModuleFilter) {
  return (
    disableFutureDate(current) || current.isBefore(filter.draftDates[0], 'day')
  );
}

function createStartDateText(filter: DashboardModuleFilter) {
  return computed(() => filter.appliedDates[0].format('YYYY-MM-DD'));
}

function createEndDateText(filter: DashboardModuleFilter) {
  return computed(() => filter.appliedDates[1].format('YYYY-MM-DD'));
}

const isMobile = ref(false);
const revenueFilter = createDashboardModuleFilter();
const investmentFilter = createDashboardModuleFilter();
const contractFilter = createDashboardModuleFilter();
const customerFilter = createDashboardModuleFilter();
const energyFilter = createDashboardModuleFilter();
const countFilter = createDashboardModuleFilter();
const parkOptions = ref<ParkOption[]>([allParkOption]);
const revenueStartDateText = createStartDateText(revenueFilter);
const revenueEndDateText = createEndDateText(revenueFilter);
const investmentStartDateText = createStartDateText(investmentFilter);
const investmentEndDateText = createEndDateText(investmentFilter);
const contractStartDateText = createStartDateText(contractFilter);
const contractEndDateText = createEndDateText(contractFilter);
const customerStartDateText = createStartDateText(customerFilter);
const customerEndDateText = createEndDateText(customerFilter);
const energyStartDateText = createStartDateText(energyFilter);
const energyEndDateText = createEndDateText(energyFilter);
const countStartDateText = createStartDateText(countFilter);
const countEndDateText = createEndDateText(countFilter);

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
          <div
            class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end"
          >
            <DatePicker
              :value="revenueFilter.draftDates[0]"
              :allow-clear="false"
              :disabled-date="disableFutureDate"
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="开始日期"
              size="middle"
              @update:value="
                (value) => updateDraftStartDate(revenueFilter, value)
              "
            />
            <DatePicker
              :value="revenueFilter.draftDates[1]"
              :allow-clear="false"
              :disabled-date="
                (current) => disableEndDate(current, revenueFilter)
              "
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="结束日期"
              size="middle"
              @update:value="
                (value) => updateDraftEndDate(revenueFilter, value)
              "
            />
            <Select
              v-model:value="revenueFilter.draftParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
            <Button
              class="w-full sm:w-auto"
              size="middle"
              type="primary"
              @click="applyDashboardFilter(revenueFilter)"
            >
              确定
            </Button>
          </div>
        </template>
        <AnalyticsRevenue
          :end-date="revenueEndDateText"
          :park-id="revenueFilter.appliedParkId"
          :start-date="revenueStartDateText"
        />
      </AnalysisChartCard>
      <AnalysisChartCard title="厂房租赁">
        <template #extra>
          <div
            class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end"
          >
            <DatePicker
              :value="investmentFilter.draftDates[0]"
              :allow-clear="false"
              :disabled-date="disableFutureDate"
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="开始日期"
              size="middle"
              @update:value="
                (value) => updateDraftStartDate(investmentFilter, value)
              "
            />
            <DatePicker
              :value="investmentFilter.draftDates[1]"
              :allow-clear="false"
              :disabled-date="
                (current) => disableEndDate(current, investmentFilter)
              "
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="结束日期"
              size="middle"
              @update:value="
                (value) => updateDraftEndDate(investmentFilter, value)
              "
            />
            <Select
              v-model:value="investmentFilter.draftParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
            <Button
              class="w-full sm:w-auto"
              size="middle"
              type="primary"
              @click="applyDashboardFilter(investmentFilter)"
            >
              确定
            </Button>
          </div>
        </template>
        <AnalyticsInvestment
          :end-date="investmentEndDateText"
          :park-id="investmentFilter.appliedParkId"
          :start-date="investmentStartDateText"
        />
      </AnalysisChartCard>
      <AnalysisChartCard title="合同总览">
        <template #extra>
          <div
            class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end"
          >
            <DatePicker
              :value="contractFilter.draftDates[0]"
              :allow-clear="false"
              :disabled-date="disableFutureDate"
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="开始日期"
              size="middle"
              @update:value="
                (value) => updateDraftStartDate(contractFilter, value)
              "
            />
            <DatePicker
              :value="contractFilter.draftDates[1]"
              :allow-clear="false"
              :disabled-date="
                (current) => disableEndDate(current, contractFilter)
              "
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="结束日期"
              size="middle"
              @update:value="
                (value) => updateDraftEndDate(contractFilter, value)
              "
            />
            <Select
              v-model:value="contractFilter.draftParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
            <Button
              class="w-full sm:w-auto"
              size="middle"
              type="primary"
              @click="applyDashboardFilter(contractFilter)"
            >
              确定
            </Button>
          </div>
        </template>
        <AnalyticsContract
          :end-date="contractEndDateText"
          :park-id="contractFilter.appliedParkId"
          :start-date="contractStartDateText"
        />
      </AnalysisChartCard>
      <AnalysisChartCard title="招商总览">
        <template #extra>
          <div
            class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end"
          >
            <DatePicker
              :value="customerFilter.draftDates[0]"
              :allow-clear="false"
              :disabled-date="disableFutureDate"
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="开始日期"
              size="middle"
              @update:value="
                (value) => updateDraftStartDate(customerFilter, value)
              "
            />
            <DatePicker
              :value="customerFilter.draftDates[1]"
              :allow-clear="false"
              :disabled-date="
                (current) => disableEndDate(current, customerFilter)
              "
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="结束日期"
              size="middle"
              @update:value="
                (value) => updateDraftEndDate(customerFilter, value)
              "
            />
            <Select
              v-model:value="customerFilter.draftParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
            <Button
              class="w-full sm:w-auto"
              size="middle"
              type="primary"
              @click="applyDashboardFilter(customerFilter)"
            >
              确定
            </Button>
          </div>
        </template>
        <AnalyticsCustomer
          :end-date="customerEndDateText"
          :park-id="customerFilter.appliedParkId"
          :start-date="customerStartDateText"
        />
      </AnalysisChartCard>

      <AnalysisChartCard title="能源消耗">
        <template #extra>
          <div
            class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end"
          >
            <DatePicker
              :value="energyFilter.draftDates[0]"
              :allow-clear="false"
              :disabled-date="disableFutureDate"
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="开始日期"
              size="middle"
              @update:value="
                (value) => updateDraftStartDate(energyFilter, value)
              "
            />
            <DatePicker
              :value="energyFilter.draftDates[1]"
              :allow-clear="false"
              :disabled-date="
                (current) => disableEndDate(current, energyFilter)
              "
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="结束日期"
              size="middle"
              @update:value="(value) => updateDraftEndDate(energyFilter, value)"
            />
            <Select
              v-model:value="energyFilter.draftParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
            <Button
              class="w-full sm:w-auto"
              size="middle"
              type="primary"
              @click="applyDashboardFilter(energyFilter)"
            >
              确定
            </Button>
          </div>
        </template>
        <AnalyticsEnergy
          :end-date="energyEndDateText"
          :park-id="energyFilter.appliedParkId"
          :start-date="energyStartDateText"
        />
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
          <div
            class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end"
          >
            <DatePicker
              :value="countFilter.draftDates[0]"
              :allow-clear="false"
              :disabled-date="disableFutureDate"
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="开始日期"
              size="middle"
              @update:value="
                (value) => updateDraftStartDate(countFilter, value)
              "
            />
            <DatePicker
              :value="countFilter.draftDates[1]"
              :allow-clear="false"
              :disabled-date="(current) => disableEndDate(current, countFilter)"
              class="w-full sm:w-[132px]"
              format="YYYY-MM-DD"
              placeholder="结束日期"
              size="middle"
              @update:value="(value) => updateDraftEndDate(countFilter, value)"
            />
            <Select
              v-model:value="countFilter.draftParkId"
              :options="parkOptions"
              class="w-full sm:w-[220px]"
              size="middle"
            />
            <Button
              class="w-full sm:w-auto"
              size="middle"
              type="primary"
              @click="applyDashboardFilter(countFilter)"
            >
              确定
            </Button>
          </div>
        </template>
        <AnalyticsCount
          :end-date="countEndDateText"
          :park-id="countFilter.appliedParkId"
          :start-date="countStartDateText"
        />
      </AnalysisChartCard>
    </div>
  </div>
</template>
