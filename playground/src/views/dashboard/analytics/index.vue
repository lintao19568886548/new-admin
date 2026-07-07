<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { ParkOption, ParkOptionValue } from './components/parkOptions';

import type {
  DashboardWorkbenchTodo,
  DashboardWorkbenchTodoSection,
  DashboardWorkbenchTodoType,
} from '#/api/dashboard';

import { computed, h, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AnalysisChartCard } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, DatePicker, notification, Select } from 'ant-design-vue';
import dayjs from 'dayjs';

import { getDashboardWorkbenchTodos } from '#/api/dashboard';
import { getParkList } from '#/api/park';
import {
  getPendingReimbursementCount,
  getReimbursementList,
} from '#/api/reimbursement';
import { subscribeWorkbenchTodoChanged } from '#/utils/workbench-todo-sync';

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

interface WorkbenchTodoTypeMeta {
  icon: string;
  title: string;
  tone: 'amber' | 'blue' | 'cyan' | 'orange' | 'red' | 'sky' | 'slate';
}

interface WorkbenchTodoRoute {
  names?: string[];
  path: string;
  query?: Record<string, number | string>;
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
const WORKBENCH_TODO_PREVIEW_LIMIT = 8;
const WORKBENCH_TODO_CARD_TYPES: DashboardWorkbenchTodoType[] = [
  'rent_unreceived',
  'contract_expire',
  'reimbursement_audit',
  'investment_lead',
  'vacant_factory',
  'repair_order',
  'attendance_abnormal',
];
const WORKBENCH_TODO_TYPE_META: Record<
  DashboardWorkbenchTodoType,
  WorkbenchTodoTypeMeta
> = {
  attendance_abnormal: {
    icon: 'mdi:calendar-alert-outline',
    title: '考勤异常',
    tone: 'orange',
  },
  contract_expire: {
    icon: 'mdi:file-clock-outline',
    title: '合同到期提醒',
    tone: 'amber',
  },
  investment_lead: {
    icon: 'mdi:radar',
    title: '招商线索',
    tone: 'cyan',
  },
  reimbursement_audit: {
    icon: 'mdi:file-check-outline',
    title: '待处理报销',
    tone: 'blue',
  },
  rent_unreceived: {
    icon: 'mdi:cash-clock',
    title: '未收租提醒',
    tone: 'red',
  },
  repair_order: {
    icon: 'mdi:clipboard-text-clock',
    title: '维护工单',
    tone: 'slate',
  },
  vacant_factory: {
    icon: 'mdi:office-building-marker-outline',
    title: '空置厂房',
    tone: 'orange',
  },
};
const WORKBENCH_TODO_PC_ROUTES: Record<
  DashboardWorkbenchTodoType,
  WorkbenchTodoRoute
> = {
  attendance_abnormal: {
    names: ['HrmAttendanceStats'],
    path: '/hrm/attendance/stats',
    query: { attendanceStatus: 'abnormal' },
  },
  contract_expire: {
    names: ['TenantManage'],
    path: '/rental/tenant',
    query: { contractView: 'attention' },
  },
  investment_lead: {
    names: ['InvestmentAgent'],
    path: '/investment/agent',
    query: { todoView: 'followup' },
  },
  reimbursement_audit: {
    names: ['ReimbursementAudit'],
    path: '/reimbursement/audit',
    query: { status: 0 },
  },
  rent_unreceived: {
    names: ['Bill'],
    path: '/bill',
    query: { collectionStatus: 'unreceived' },
  },
  repair_order: {
    names: ['RepairOrder'],
    path: '/maintenance/repair-order',
    query: { todoView: 'processing' },
  },
  vacant_factory: {
    names: ['FactoryList'],
    path: '/rental/factory',
  },
};
const revenueFilter = createDashboardModuleFilter();
const investmentFilter = createDashboardModuleFilter();
const contractFilter = createDashboardModuleFilter();
const customerFilter = createDashboardModuleFilter();
const energyFilter = createDashboardModuleFilter();
const countFilter = createDashboardModuleFilter();
const parkOptions = ref<ParkOption[]>([allParkOption]);
const workbenchTodosLoading = ref(false);
const workbenchTodoSections = ref<DashboardWorkbenchTodoSection[]>([]);
const workbenchTodoTotal = ref(0);
let stopWorkbenchTodoChanged: (() => void) | undefined;
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
const workbenchTodoSectionMap = computed(() => {
  return new Map(
    workbenchTodoSections.value.map((section) => [section.key, section]),
  );
});
const workbenchTodoCards = computed(() =>
  WORKBENCH_TODO_CARD_TYPES.map((type) => {
    const section = workbenchTodoSectionMap.value.get(type);
    return {
      count: section?.count ?? 0,
      meta: WORKBENCH_TODO_TYPE_META[type],
      type,
    };
  }),
);
const allWorkbenchTodos = computed(() =>
  workbenchTodoSections.value.flatMap((section) => section.items),
);
const priorityWorkbenchTodos = computed(() =>
  [...allWorkbenchTodos.value]
    .sort(compareWorkbenchTodo)
    .slice(0, WORKBENCH_TODO_PREVIEW_LIMIT),
);
const priorityTodoSummary = computed(() => {
  const urgentCount = priorityWorkbenchTodos.value.filter(
    (todo) => todo.priority === 'urgent',
  ).length;
  const warningCount = priorityWorkbenchTodos.value.filter(
    (todo) => todo.priority === 'warning',
  ).length;
  const parts: string[] = [];

  if (urgentCount > 0) {
    parts.push(`${urgentCount} 条紧急`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} 条关注`);
  }
  parts.push(`共 ${workbenchTodoTotal.value} 条`);
  return parts.join(' / ');
});

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

async function refreshWorkbenchTodos(force = false) {
  workbenchTodosLoading.value = true;
  try {
    const todos = await getDashboardWorkbenchTodos({ force });
    workbenchTodoSections.value = Array.isArray(todos?.sections)
      ? todos.sections
      : [];
    workbenchTodoTotal.value = Number(todos?.summary?.total || 0);
  } catch (error) {
    console.error('获取PC总览待办失败:', error);
    workbenchTodoSections.value = [];
    workbenchTodoTotal.value = 0;
  } finally {
    workbenchTodosLoading.value = false;
  }
}

function getWorkbenchTodoPriorityWeight(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') return 0;
  if (priority === 'warning') return 1;
  return 2;
}

function getWorkbenchTodoRiskScore(todo: DashboardWorkbenchTodo) {
  const value = todo.meta?.riskScore;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function compareWorkbenchTodo(
  first: DashboardWorkbenchTodo,
  second: DashboardWorkbenchTodo,
) {
  const priorityDiff =
    getWorkbenchTodoPriorityWeight(first.priority) -
    getWorkbenchTodoPriorityWeight(second.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const riskDiff =
    getWorkbenchTodoRiskScore(second) - getWorkbenchTodoRiskScore(first);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = new Date(first.dueTime || first.createTime || 0).getTime();
  const secondTime = new Date(
    second.dueTime || second.createTime || 0,
  ).getTime();
  return firstTime - secondTime;
}

function normalizeRouteQuery(query?: Record<string, number | string>) {
  return Object.fromEntries(
    Object.entries(query ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Record<string, number | string>;
}

function buildWorkbenchTodoRoute(todo: DashboardWorkbenchTodo) {
  const routeConfig = WORKBENCH_TODO_PC_ROUTES[todo.type];
  const query = normalizeRouteQuery({
    ...routeConfig.query,
    ...todo.routeQuery,
  });
  const routeName = routeConfig.names?.find((name) => router.hasRoute(name));

  if (routeName) {
    return Object.keys(query).length > 0
      ? { name: routeName, query }
      : { name: routeName };
  }

  return Object.keys(query).length > 0
    ? { path: routeConfig.path, query }
    : { path: routeConfig.path };
}

function buildWorkbenchTodoTypeRoute(type: DashboardWorkbenchTodoType) {
  const routeConfig = WORKBENCH_TODO_PC_ROUTES[type];
  const query = normalizeRouteQuery(routeConfig.query);
  const routeName = routeConfig.names?.find((name) => router.hasRoute(name));

  if (routeName) {
    return Object.keys(query).length > 0
      ? { name: routeName, query }
      : { name: routeName };
  }

  return Object.keys(query).length > 0
    ? { path: routeConfig.path, query }
    : { path: routeConfig.path };
}

async function goWorkbenchTodo(todo: DashboardWorkbenchTodo) {
  await router.push(buildWorkbenchTodoRoute(todo));
}

async function goWorkbenchTodoType(type: DashboardWorkbenchTodoType) {
  await router.push(buildWorkbenchTodoTypeRoute(type));
}

function getWorkbenchTodoCardClass(tone: WorkbenchTodoTypeMeta['tone']) {
  const classMap: Record<WorkbenchTodoTypeMeta['tone'], string> = {
    amber:
      'border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200',
    blue: 'border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200',
    cyan: 'border-cyan-100 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-200',
    orange:
      'border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200',
    red: 'border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200',
    sky: 'border-sky-100 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200',
    slate:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };
  return classMap[tone];
}

function getWorkbenchTodoPriorityClass(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') {
    return 'border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200';
  }
  if (priority === 'warning') {
    return 'border-orange-100 bg-orange-50 text-orange-600 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200';
  }
  return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

function getWorkbenchTodoPriorityText(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') return '紧急处理';
  if (priority === 'warning') return '重点关注';
  return '常规提醒';
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
  void refreshWorkbenchTodos();
  stopWorkbenchTodoChanged = subscribeWorkbenchTodoChanged(() => {
    void refreshWorkbenchTodos(true);
  });
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
  stopWorkbenchTodoChanged?.();
  stopWorkbenchTodoChanged = undefined;
});
</script>

<template>
  <div class="p-5">
    <section
      class="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-50">
            待办提醒
          </h2>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            跨模块急件、逾期事项和待处理工作统一汇总
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            共 {{ workbenchTodoTotal }} 条
          </span>
          <Button
            :loading="workbenchTodosLoading"
            size="small"
            @click="refreshWorkbenchTodos(true)"
          >
            刷新
          </Button>
        </div>
      </div>

      <div
        class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]"
      >
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            v-for="card in workbenchTodoCards"
            :key="card.type"
            type="button"
            class="flex min-h-[88px] items-center gap-3 rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
            :class="getWorkbenchTodoCardClass(card.meta.tone)"
            @click="goWorkbenchTodoType(card.type)"
          >
            <span
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 text-xl shadow-sm dark:bg-slate-950/40"
            >
              <VbenIcon :icon="card.meta.icon" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold">
                {{ card.meta.title }}
              </span>
              <span class="mt-1 block text-2xl font-bold leading-7">
                {{ card.count }}
              </span>
            </span>
          </button>
        </div>

        <div
          class="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/30"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <div
                class="text-sm font-semibold text-slate-900 dark:text-slate-50"
              >
                优先处理
              </div>
              <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {{ priorityTodoSummary }}
              </div>
            </div>
          </div>

          <div
            v-if="priorityWorkbenchTodos.length > 0"
            class="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              v-for="todo in priorityWorkbenchTodos"
              :key="todo.todoId"
              type="button"
              class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
              @click="goWorkbenchTodo(todo)"
            >
              <span
                class="shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold"
                :class="getWorkbenchTodoPriorityClass(todo.priority)"
              >
                {{ getWorkbenchTodoPriorityText(todo.priority) }}
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm font-semibold text-slate-900 dark:text-slate-50"
                >
                  {{ todo.businessName }}
                </span>
                <span
                  class="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400"
                >
                  {{ todo.title }} · {{ todo.content }}
                </span>
              </span>
              <span class="shrink-0 text-xs font-semibold text-blue-600">
                处理
              </span>
            </button>
          </div>

          <div
            v-else
            class="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            暂无待优先处理事项
          </div>
        </div>
      </div>
    </section>

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
