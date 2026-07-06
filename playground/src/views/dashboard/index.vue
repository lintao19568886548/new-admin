<script lang="ts" setup>
import type { RouteLocationRaw } from 'vue-router';

import type {
  DashboardWorkbenchTodo,
  DashboardWorkbenchTodoSection,
  DashboardWorkbenchTodoType,
} from '#/api/dashboard';

import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Card, Col, Row, Skeleton } from 'ant-design-vue';
import dayjs from 'dayjs';

import { getDashboardWorkbenchTodos } from '#/api/dashboard';
import { getTodayRecord } from '#/api/hrm/attendance';
import { getReimbursementSummary } from '#/api/reimbursement/reimbursement';
import { useAuthStore } from '#/store';
import { requireLogin } from '#/utils/require-login';
import { subscribeWorkbenchTodoChanged } from '#/utils/workbench-todo-sync';

interface CheckInPreview {
  hasSignedIn: boolean;
  punchIn: string;
  punchOut: string;
}

interface WorkItemRoute {
  names?: string[];
  path: string;
  query?: Record<string, number | string>;
}

interface WorkItemDefinition {
  badge?: () => string;
  emptyText?: string;
  icon: string;
  key: string;
  route: WorkItemRoute;
  summary?: () => string;
  title: string;
  todoTypes?: DashboardWorkbenchTodoType[];
}

const ROLE_WORK_ITEMS = {
  access: ['attendance', 'car-access', 'access-brand'],
  finance: [
    'attendance',
    'rent-unreceived',
    'reimbursement-audit',
    'finance-manage',
    'smart-billing',
  ],
  hrm: [
    'attendance',
    'attendance-abnormal',
    'leave-application',
    'attendance-trajectory',
    'hrm-information',
  ],
  investment: [
    'attendance',
    'vacant-factory',
    'investment-leads',
    'customer-registration',
    'investment-radar',
    'public-demands',
    'public-factory-listings',
  ],
  maintenance: [
    'attendance',
    'maintenance-orders',
    'transformer-maintenance',
    'factory-maintenance',
    'elevator-management',
    'firefighting-management',
  ],
  park: [
    'attendance',
    'contract-expiry',
    'rent-unreceived',
    'vacant-factory',
    'investment-leads',
    'maintenance-orders',
  ],
  super: [
    'attendance',
    'pending-reimbursement',
    'contract-expiry',
    'rent-unreceived',
    'vacant-factory',
    'investment-leads',
    'maintenance-orders',
    'attendance-abnormal',
  ],
} as const;

const ROLE_ALIASES = {
  access: ['门禁', '门禁/前台', '前台', '总台', '安保'],
  finance: ['财务', '财务部'],
  hrm: ['人事', '人事部', 'HR', 'hr'],
  investment: ['招商', '招商部'],
  maintenance: ['维护', '维修', '维保', '维护部'],
  park: ['园区经理', '园区', '运营', '项目经理', '物业'],
  super: ['Super', '超管', '超级管理员', '老板', '董事长', '总经理'],
} as const;

const loading = ref(true);
const WORKBENCH_PREVIEW_REFRESH_INTERVAL = 3 * 60 * 60 * 1000;
const route = useRoute();
const router = useRouter();
const accessStore = useAccessStore();
const authStore = useAuthStore();
const userStore = useUserStore();
const reimburse = ref({ approved: 0, pending: 0, rejected: 0, total: 0 });
const workbenchTodoSections = ref<DashboardWorkbenchTodoSection[]>([]);
const checkIn = ref<CheckInPreview>({
  hasSignedIn: false,
  punchIn: '',
  punchOut: '',
});
const isAuthenticated = computed(() => Boolean(accessStore.accessToken));
const canFetchPreviewData = computed(
  () => route.path === '/home' && isAuthenticated.value,
);
const checkInStatusText = computed(() =>
  checkIn.value.hasSignedIn ? '已签到' : '未签到',
);
let previewRefreshTimer: ReturnType<typeof setInterval> | undefined;
let stopWorkbenchTodoChanged: (() => void) | undefined;
const roleNames = computed(() => {
  const roles =
    userStore.userRoles.length > 0
      ? userStore.userRoles
      : userStore.userInfo?.roles || [];
  return roles.map((role) => String(role).trim()).filter(Boolean);
});
const isSuperRole = computed(() => hasAnyRole(ROLE_ALIASES.super));
const roleWorkItemKeys = computed(() => {
  if (!isAuthenticated.value) {
    return ROLE_WORK_ITEMS.super;
  }

  if (isSuperRole.value) {
    return ROLE_WORK_ITEMS.super;
  }

  const keys = ['attendance'];
  if (hasAnyRole(ROLE_ALIASES.finance)) {
    keys.push(...ROLE_WORK_ITEMS.finance);
  }
  if (hasAnyRole(ROLE_ALIASES.hrm)) {
    keys.push(...ROLE_WORK_ITEMS.hrm);
  }
  if (hasAnyRole(ROLE_ALIASES.access)) {
    keys.push(...ROLE_WORK_ITEMS.access);
  }
  if (hasAnyRole(ROLE_ALIASES.investment)) {
    keys.push(...ROLE_WORK_ITEMS.investment);
  }
  if (hasAnyRole(ROLE_ALIASES.maintenance)) {
    keys.push(...ROLE_WORK_ITEMS.maintenance);
  }
  if (hasAnyRole(ROLE_ALIASES.park)) {
    keys.push(...ROLE_WORK_ITEMS.park);
  }

  return [...new Set(keys)];
});
const workItems = computed(() => {
  const items: WorkItemDefinition[] = [];
  for (const key of roleWorkItemKeys.value) {
    const item = WORK_ITEM_DEFINITIONS[key];
    if (item) {
      items.push(item);
    }
  }
  return items;
});
const workbenchTodoSectionMap = computed(() => {
  return new Map(
    workbenchTodoSections.value.map((section) => [section.key, section]),
  );
});

const WORK_ITEM_DEFINITIONS: Record<string, WorkItemDefinition> = {
  'access-brand': {
    icon: 'carbon:badge',
    key: 'access-brand',
    route: {
      names: ['AccessBrandMobile', 'AccessBrand'],
      path: '/access/brand/mobile',
    },
    title: '门禁品牌管理',
  },
  attendance: {
    badge: () => checkInStatusText.value,
    icon: 'mdi:calendar-check-outline',
    key: 'attendance',
    route: {
      names: ['HrmAttendancePunch', 'attendance'],
      path: '/hrm/attendance/punch',
    },
    summary: () =>
      `上班 ${checkIn.value.punchIn || '--:--:--'} / 下班 ${
        checkIn.value.punchOut || '--:--:--'
      }`,
    title: '考勤打卡',
  },
  'attendance-abnormal': {
    badge: () => getTodoBadge(['attendance_abnormal']),
    emptyText: '暂无考勤异常',
    icon: 'mdi:calendar-alert-outline',
    key: 'attendance-abnormal',
    route: {
      names: ['HrmAttendanceStats'],
      path: '/hrm/attendance/stats',
      query: {
        attendanceStatus: 'abnormal',
      },
    },
    title: '考勤异常',
    todoTypes: ['attendance_abnormal'],
  },
  'attendance-trajectory': {
    icon: 'mdi:map-marker-path',
    key: 'attendance-trajectory',
    route: { names: ['HrmTrajectory'], path: '/hrm/trajectory' },
    title: '考勤轨迹',
  },
  'car-access': {
    icon: 'carbon:car',
    key: 'car-access',
    route: {
      names: ['CarAccessMobile', 'CarAccess'],
      path: '/access/car/mobile',
    },
    title: '车辆出入管理',
  },
  'contract-expiry': {
    badge: () => getTodoBadge(['contract_expire']),
    emptyText: '暂无即将到期合同',
    icon: 'mdi:file-clock-outline',
    key: 'contract-expiry',
    route: {
      names: ['TenantMobileList', 'TenantManage'],
      path: '/rental/tenant/mobile',
      query: {
        contractView: 'attention',
      },
    },
    title: '合同到期提醒',
    todoTypes: ['contract_expire'],
  },
  'customer-registration': {
    icon: 'mdi:account-plus-outline',
    key: 'customer-registration',
    route: {
      names: ['InvestmentAgentMobileList', 'InvestmentAgent'],
      path: '/investment/mobile',
    },
    title: '客户登记',
  },
  'elevator-management': {
    icon: 'mdi:elevator',
    key: 'elevator-management',
    route: {
      names: ['ElevatorMobile', 'Elevator'],
      path: '/maintenance/elevator/mobile',
    },
    title: '电梯管理',
  },
  'factory-maintenance': {
    icon: 'mdi:office-building-cog',
    key: 'factory-maintenance',
    route: {
      names: ['FactoryMaintMobile', 'FactoryMaint'],
      path: '/maintenance/factoryMaint/mobile',
    },
    title: '厂房维护',
  },
  'finance-manage': {
    icon: 'mdi:currency-usd',
    key: 'finance-manage',
    route: {
      names: ['FinanceMobileManage', 'FinanceManage'],
      path: '/finance/mobile-manage',
    },
    title: '财务管理',
  },
  'firefighting-management': {
    icon: 'mdi:fire-extinguisher',
    key: 'firefighting-management',
    route: {
      names: ['FirefightingMobile', 'Firefighting'],
      path: '/maintenance/firefighting/mobile',
    },
    title: '消防管理',
  },
  'hrm-information': {
    icon: 'mdi:account-group-outline',
    key: 'hrm-information',
    route: {
      names: ['HrmMobileInformation', 'HrmInformationMobile', 'HrmInformation'],
      path: '/hrm/mobile-information',
    },
    title: '人员信息',
  },
  'investment-leads': {
    badge: () => getTodoBadge(['investment_lead']),
    emptyText: '暂无待跟进招商线索',
    icon: 'mdi:radar',
    key: 'investment-leads',
    route: {
      names: ['InvestmentAgentMobileList', 'InvestmentAgent'],
      path: '/investment/mobile',
    },
    title: '招商线索',
    todoTypes: ['investment_lead'],
  },
  'investment-radar': {
    icon: 'mdi:radar',
    key: 'investment-radar',
    route: {
      names: ['InvestmentRadarMobileList'],
      path: '/investment/radar/mobile',
    },
    title: '智能招商雷达',
  },
  'leave-application': {
    icon: 'mdi:calendar-account-outline',
    key: 'leave-application',
    route: {
      names: ['HrmLeaveApplicationMobile', 'HrmLeaveApplication'],
      path: '/hrm/leavemobile',
    },
    title: '请假申请/审批',
  },
  'maintenance-orders': {
    badge: () => getTodoBadge(['repair_order']),
    emptyText: '暂无待处理维护工单',
    icon: 'mdi:clipboard-text-clock',
    key: 'maintenance-orders',
    route: {
      names: ['RepairOrderMobile', 'RepairOrder'],
      path: '/maintenance/repair-order/mobile',
    },
    title: '维护工单',
    todoTypes: ['repair_order'],
  },
  'pending-reimbursement': {
    badge: () =>
      reimburse.value.pending > 0 ? `${reimburse.value.pending} 条` : '',
    icon: 'mdi:file-document-alert-outline',
    key: 'pending-reimbursement',
    route: {
      names: ['ReimbursementMobileAudit', 'ReimbursementAudit'],
      path: '/reimbursement/mobile-audit',
    },
    summary: () =>
      reimburse.value.pending > 0
        ? `${reimburse.value.pending} 条报销待处理`
        : '暂无待处理报销',
    title: '待处理报销',
  },
  'public-demands': {
    icon: 'mdi:briefcase-search-outline',
    key: 'public-demands',
    route: {
      names: ['InvestmentRadarMobilePublicDemands'],
      path: '/investment/radar/mobile-public-demands',
    },
    title: '公开需求',
  },
  'reimbursement-audit': {
    badge: () =>
      reimburse.value.pending > 0 ? `${reimburse.value.pending} 条` : '',
    icon: 'mdi:file-check-outline',
    key: 'reimbursement-audit',
    route: {
      names: ['ReimbursementMobileAudit', 'ReimbursementAudit'],
      path: '/reimbursement/mobile-audit',
    },
    summary: () =>
      reimburse.value.pending > 0
        ? `${reimburse.value.pending} 条待审核`
        : '查看报销审核',
    title: '报销审核',
  },
  'rent-unreceived': {
    badge: () => getTodoBadge(['rent_unreceived']),
    emptyText: '暂无未收租账单',
    icon: 'mdi:cash-clock',
    key: 'rent-unreceived',
    route: {
      names: ['BillMobileList', 'Bill'],
      path: '/bill/mobile-list',
      query: {
        collectionStatus: 'unreceived',
      },
    },
    title: '未收租提醒',
    todoTypes: ['rent_unreceived'],
  },
  'smart-billing': {
    icon: 'mdi:file-document-edit-outline',
    key: 'smart-billing',
    route: { names: ['BillMobileList', 'Bill'], path: '/bill/mobile-list' },
    title: '智能制单',
  },
  'transformer-maintenance': {
    icon: 'mdi:lightning-bolt',
    key: 'transformer-maintenance',
    route: {
      names: ['TransformerMobile', 'Transformer'],
      path: '/maintenance/transformer/mobile',
    },
    title: '变压器维保',
  },
  'vacant-factory': {
    badge: () => getTodoBadge(['vacant_factory']),
    emptyText: '暂无空置厂房提醒',
    icon: 'mdi:office-building-marker-outline',
    key: 'vacant-factory',
    route: {
      names: ['FactoryList'],
      path: '/rental/factory',
    },
    title: '空置厂房',
    todoTypes: ['vacant_factory'],
  },
  'public-factory-listings': {
    icon: 'mdi:office-building-marker-outline',
    key: 'public-factory-listings',
    route: {
      names: ['InvestmentRadarMobileFactoryListings'],
      path: '/investment/radar/mobile-factory-listings',
    },
    title: '公开房源',
  },
};

onMounted(() => {
  stopWorkbenchTodoChanged = subscribeWorkbenchTodoChanged(() => {
    void fetchPreviewData({ forceTodos: true, showLoading: false });
  });

  if (canFetchPreviewData.value) {
    loading.value = false;
    void fetchPreviewData();
    startPreviewRefresh();
    return;
  }
  loading.value = false;
});

onActivated(() => {
  if (canFetchPreviewData.value) {
    void fetchPreviewData({ forceTodos: true, showLoading: false });
  }
});

onUnmounted(() => {
  stopPreviewRefresh();
  stopWorkbenchTodoChanged?.();
  stopWorkbenchTodoChanged = undefined;
});

function startPreviewRefresh() {
  if (previewRefreshTimer) {
    return;
  }

  previewRefreshTimer = setInterval(() => {
    if (canFetchPreviewData.value) {
      void fetchPreviewData({ showLoading: false });
    }
  }, WORKBENCH_PREVIEW_REFRESH_INTERVAL);
}

function stopPreviewRefresh() {
  if (!previewRefreshTimer) {
    return;
  }

  clearInterval(previewRefreshTimer);
  previewRefreshTimer = undefined;
}

async function fetchPreviewData(
  options: { forceTodos?: boolean; showLoading?: boolean } = {},
) {
  if (!canFetchPreviewData.value) {
    loading.value = false;
    return;
  }

  const showLoading = options.showLoading ?? true;
  if (showLoading) {
    loading.value = true;
  }
  try {
    await Promise.allSettled([
      refreshReimbursementSummary(),
      refreshWorkbenchTodos(options.forceTodos),
      refreshTodayAttendance(),
    ]);
  } finally {
    if (showLoading) {
      loading.value = false;
    }
  }
}

async function refreshReimbursementSummary() {
  try {
    const summary = await getReimbursementSummary();
    reimburse.value = {
      approved: summary?.approved || 0,
      pending: summary?.pending || 0,
      rejected: summary?.rejected || 0,
      total: summary?.total || 0,
    };
  } catch (error) {
    console.error('reimbursement stats failed', error);
  }
}

async function refreshTodayAttendance() {
  try {
    const username = userStore.userInfo?.realName;
    if (username) {
      const data = await getTodayRecord({ username });
      checkIn.value = {
        hasSignedIn: Boolean(data?.punchIn),
        punchIn: data?.punchIn ? dayjs(data.punchIn).format('HH:mm:ss') : '',
        punchOut: data?.punchOut ? dayjs(data.punchOut).format('HH:mm:ss') : '',
      };
      return;
    }

    checkIn.value = { hasSignedIn: false, punchIn: '', punchOut: '' };
  } catch (error) {
    console.error('today attendance failed', error);
    checkIn.value = { hasSignedIn: false, punchIn: '', punchOut: '' };
  }
}

watch(canFetchPreviewData, (canFetch, previousCanFetch) => {
  if (canFetch && !previousCanFetch) {
    void fetchPreviewData();
    startPreviewRefresh();
    return;
  }

  if (!canFetch) {
    stopPreviewRefresh();
  }
});

async function goWorkItem(item: WorkItemDefinition) {
  if (!(await requireLogin(router, item.route.path))) {
    return;
  }

  await pushAvailableRoute(item.route);
}

async function goTodo(todo: DashboardWorkbenchTodo) {
  if (!(await requireLogin(router, todo.routePath))) {
    return;
  }

  await pushAvailableRoute({
    names: todo.routeName ? [todo.routeName] : undefined,
    path: todo.routePath,
    query: todo.routeQuery,
  });
}

async function refreshWorkbenchTodos(force = false) {
  const todos = await getDashboardWorkbenchTodos({ force });
  const sections = Array.isArray(todos?.sections) ? todos.sections : [];
  workbenchTodoSections.value = sections;
}

async function pushAvailableRoute(routeConfig: WorkItemRoute) {
  try {
    const routeLocation = resolveAvailableRouteLocation(routeConfig);
    if (routeLocation) {
      await router.push(routeLocation);
      return;
    }

    await authStore.ensureSessionReady({ forceRebuildAccess: true });
    const refreshedRouteLocation = resolveAvailableRouteLocation(routeConfig);
    if (refreshedRouteLocation) {
      await router.push(refreshedRouteLocation);
      return;
    }

    await router.push(buildPathRouteLocation(routeConfig));
  } catch (error) {
    console.error('go work item failed:', error);
  }
}

function resolveAvailableRouteLocation(
  routeConfig: WorkItemRoute,
): null | RouteLocationRaw {
  const routeNames = routeConfig.names || [];

  for (const name of routeNames) {
    if (!router.hasRoute(name)) continue;
    return buildNamedRouteLocation(name, routeConfig);
  }

  const targetPath = normalizeRoutePath(routeConfig.path);
  const hasPathRoute = router
    .getRoutes()
    .some((route) => normalizeRoutePath(route.path) === targetPath);
  return hasPathRoute ? buildPathRouteLocation(routeConfig) : null;
}

function buildNamedRouteLocation(
  name: string,
  routeConfig: WorkItemRoute,
): RouteLocationRaw {
  const query = normalizeRouteQuery(routeConfig.query);
  if (Object.keys(query).length > 0) {
    return {
      name,
      query,
    };
  }

  if (name === 'TenantMobileList' || name === 'TenantManage') {
    return {
      name,
      query: {
        contractView: 'attention',
      },
    };
  }

  if (routeConfig.path.includes('tenant')) {
    return {
      path: routeConfig.path,
      query: {
        contractView: 'attention',
      },
    };
  }

  return { name };
}

function buildPathRouteLocation(routeConfig: WorkItemRoute): RouteLocationRaw {
  const query = normalizeRouteQuery(routeConfig.query);
  if (Object.keys(query).length > 0) {
    return {
      path: routeConfig.path,
      query,
    };
  }

  if (routeConfig.path.includes('tenant')) {
    return {
      path: routeConfig.path,
      query: {
        contractView: 'attention',
      },
    };
  }

  return routeConfig.path;
}

function normalizeRoutePath(path: string) {
  return path.replace(/\/+$/, '') || '/';
}

function normalizeRouteQuery(query?: Record<string, number | string>) {
  return Object.fromEntries(
    Object.entries(query ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ) as Record<string, number | string>;
}

function getTodoItems(types?: DashboardWorkbenchTodoType[]) {
  if (!types?.length) {
    return [];
  }

  return types.flatMap(
    (type) => workbenchTodoSectionMap.value.get(type)?.items ?? [],
  );
}

function getTodoCount(types?: DashboardWorkbenchTodoType[]) {
  if (!types?.length) {
    return 0;
  }

  return types.reduce(
    (total, type) =>
      total + (workbenchTodoSectionMap.value.get(type)?.count ?? 0),
    0,
  );
}

function getTodoBadge(types?: DashboardWorkbenchTodoType[]) {
  const count = getTodoCount(types);
  return count > 0 ? `${count} 条` : '';
}

function priorityText(priority: DashboardWorkbenchTodo['priority']) {
  if (priority === 'urgent') {
    return '紧急处理';
  }
  if (priority === 'warning') {
    return '重点关注';
  }
  return '常规提醒';
}

function priorityTagClass(priority: DashboardWorkbenchTodo['priority']) {
  if (priority === 'urgent') {
    return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-200';
  }
  if (priority === 'warning') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200';
  }
  return 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-200';
}

function priorityClass(priority: DashboardWorkbenchTodo['priority']) {
  if (priority === 'urgent') {
    return 'border-red-100 bg-red-50/80 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300';
  }
  if (priority === 'warning') {
    return 'border-amber-100 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300';
  }
  return 'border-sky-100 bg-sky-50/80 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300';
}

function hasAnyRole(aliases: readonly string[]) {
  return roleNames.value.some((role) =>
    aliases.some((alias) => role.toLowerCase().includes(alias.toLowerCase())),
  );
}
</script>

<template>
  <div class="dark:bg-background min-h-full bg-[#f5f7fb] p-4">
    <template v-if="loading">
      <Row :gutter="[16, 16]">
        <Col v-for="n in 4" :key="n" :lg="6" :md="6" :sm="12" :xs="12">
          <Card>
            <Skeleton active :paragraph="{ rows: 1 }" avatar />
          </Card>
        </Col>
      </Row>
    </template>

    <template v-else>
      <div class="mt-2">
        <Row :gutter="[16, 16]">
          <Col
            v-for="item in workItems"
            :key="item.key"
            :lg="8"
            :md="8"
            :sm="24"
            :xs="24"
          >
            <div
              v-if="item.key === 'attendance'"
              class="group relative cursor-pointer"
              @click="goWorkItem(item)"
            >
              <div
                class="relative overflow-hidden rounded-2xl border border-cyan-100/80 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-3 shadow-[0_10px_24px_rgba(45,212,191,0.14)] ring-1 ring-cyan-50 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_28px_rgba(45,212,191,0.18)] dark:border-slate-600/80 dark:from-slate-800/95 dark:via-slate-800/95 dark:to-emerald-950/40 dark:ring-slate-700/60"
              >
                <div
                  class="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-200/20 via-transparent to-emerald-200/30"
                ></div>
                <div
                  class="relative z-10 flex items-center justify-between gap-2"
                >
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex h-7 w-7 items-center justify-center rounded-[10px] border border-sky-100 bg-sky-50 text-[15px] text-sky-500 dark:border-cyan-700/60 dark:bg-slate-700/80 dark:text-sky-300"
                    >
                      <VbenIcon icon="mdi:calendar-check-outline" />
                    </span>
                    <div>
                      <div
                        class="text-[15px] font-bold text-slate-900 dark:text-slate-100"
                      >
                        考勤打卡
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="checkIn.hasSignedIn"
                    class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  >
                    <span
                      class="h-[7px] w-[7px] rounded-full bg-current"
                    ></span>
                    {{ checkInStatusText }}
                  </div>
                  <div
                    v-else
                    class="inline-flex items-center gap-1.5 rounded-full bg-amber-100/90 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  >
                    <span
                      class="h-[7px] w-[7px] rounded-full bg-current"
                    ></span>
                    {{ checkInStatusText }}
                  </div>
                </div>

                <div class="relative z-10 mt-2.5">
                  <div class="mt-2 grid grid-cols-2 gap-2">
                    <div
                      class="rounded-[10px] border border-slate-200/90 bg-white/75 px-[9px] py-[7px] dark:border-slate-600/80 dark:bg-slate-800/70"
                    >
                      <div
                        class="text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        上班打卡
                      </div>
                      <div
                        class="mt-0.5 text-[13px] font-bold tracking-[0.2px] text-slate-900 dark:text-slate-50"
                      >
                        {{ checkIn.punchIn || '--:--:--' }}
                      </div>
                    </div>
                    <div
                      class="rounded-[10px] border border-slate-200/90 bg-white/75 px-[9px] py-[7px] dark:border-slate-600/80 dark:bg-slate-800/70"
                    >
                      <div
                        class="text-[11px] text-slate-500 dark:text-slate-400"
                      >
                        下班打卡
                      </div>
                      <div
                        class="mt-0.5 text-[13px] font-bold tracking-[0.2px] text-slate-900 dark:text-slate-50"
                      >
                        {{ checkIn.punchOut || '--:--:--' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Card
              v-else-if="
                item.key === 'pending-reimbursement' ||
                item.key === 'reimbursement-audit'
              "
              class="cursor-pointer rounded-xl bg-white shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(59,130,246,0.12)] dark:bg-gray-800 dark:ring-slate-700/70"
              @click="goWorkItem(item)"
            >
              <div class="mb-2 flex items-center justify-between">
                <div
                  class="text-base font-semibold text-gray-800 dark:text-gray-200"
                >
                  {{ item.title }}
                </div>
              </div>
              <div class="grid grid-cols-4 gap-3">
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div class="text-xl font-bold text-blue-600">
                    {{ reimburse.pending }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    待处理
                  </div>
                </div>
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div class="text-xl font-bold text-green-600">
                    {{ reimburse.approved }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    已通过
                  </div>
                </div>
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div class="text-xl font-bold text-red-500">
                    {{ reimburse.rejected }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    已拒绝
                  </div>
                </div>
                <div
                  class="rounded-[10px] bg-slate-50 px-2.5 py-2 text-center dark:bg-gray-900"
                >
                  <div
                    class="text-xl font-bold text-gray-700 dark:text-gray-200"
                  >
                    {{ reimburse.total }}
                  </div>
                  <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    总计
                  </div>
                </div>
              </div>
            </Card>

            <Card
              v-else
              class="cursor-pointer rounded-xl bg-white shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(14,165,233,0.12)] dark:bg-gray-800 dark:ring-slate-700/70"
              @click="goWorkItem(item)"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <div class="flex min-w-0 items-center gap-2">
                  <span
                    class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-sky-100 bg-sky-50 text-[15px] text-sky-500 dark:border-cyan-700/60 dark:bg-slate-700/80 dark:text-sky-300"
                  >
                    <VbenIcon :icon="item.icon" />
                  </span>
                  <div
                    class="truncate text-base font-semibold text-gray-800 dark:text-gray-200"
                  >
                    {{ item.title }}
                  </div>
                </div>
                <span
                  v-if="item.badge?.()"
                  class="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-amber-500 dark:bg-gray-900"
                >
                  {{ item.badge() }}
                </span>
              </div>
              <div
                v-if="getTodoItems(item.todoTypes).length > 0"
                class="space-y-2"
              >
                <div
                  v-for="todo in getTodoItems(item.todoTypes)"
                  :key="todo.todoId"
                  class="rounded-[10px] border px-3 py-2.5 transition-colors hover:border-sky-200 hover:bg-sky-50/70 dark:hover:border-sky-800/70 dark:hover:bg-sky-950/30"
                  :class="priorityClass(todo.priority)"
                  @click.stop="goTodo(todo)"
                >
                  <div
                    class="line-clamp-2 text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100"
                  >
                    {{ todo.content }}
                  </div>
                  <div
                    class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400"
                  >
                    <span
                      class="rounded-full px-2 py-0.5 font-semibold"
                      :class="priorityTagClass(todo.priority)"
                    >
                      {{ priorityText(todo.priority) }}
                    </span>
                    <span v-if="todo.parkName">{{ todo.parkName }}</span>
                    <a
                      v-if="todo.phoneNumber"
                      :href="`tel:${todo.phoneNumber}`"
                      class="font-semibold text-sky-600 dark:text-sky-300"
                      @click.stop
                    >
                      {{ todo.phoneNumber }}
                    </a>
                    <span>进入处理</span>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="rounded-[10px] bg-gradient-to-r from-sky-50 to-slate-50 px-3 py-2.5 ring-1 ring-sky-50 dark:from-gray-900 dark:to-gray-900 dark:ring-slate-700/60"
              >
                <div
                  class="truncate text-sm font-semibold text-gray-700 dark:text-gray-200"
                >
                  {{ item.emptyText || item.summary?.() || item.title }}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </template>
  </div>
</template>
