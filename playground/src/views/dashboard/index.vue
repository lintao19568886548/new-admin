<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { RouteLocationRaw } from 'vue-router';

import type {
  DashboardRevenueStats,
  DashboardWorkbenchTodo,
  DashboardWorkbenchTodoSection,
  DashboardWorkbenchTodoType,
} from '#/api/dashboard';

import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, DatePicker, Select, Skeleton } from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  getDashboardRevenueStats,
  getDashboardWorkbenchTodos,
} from '#/api/dashboard';
import { getTodayRecord } from '#/api/hrm/attendance';
import { getParkList } from '#/api/park';
import { getReimbursementSummary } from '#/api/reimbursement/reimbursement';
import { useAuthStore } from '#/store';
import { requireLogin } from '#/utils/require-login';
import { subscribeWorkbenchTodoChanged } from '#/utils/workbench-todo-sync';

interface CheckInPreview {
  hasSignedIn: boolean;
  punchIn: string;
  punchOut: string;
}

interface RevenueMetric {
  dotClass: string;
  key: RevenueMetricKey;
  label: string;
  value: number;
}

type RevenueMetricKey = 'receivable' | 'received' | 'remaining';

interface RevenueOverview {
  periodLabel: string;
  receivableTotal: number;
  receivedTotal: number;
  remainingTotal: number;
  trend: RevenueTrendPoint[];
}

interface RevenueTrendPoint {
  label: string;
  receivable: number;
  received: number;
  remaining: number;
}

interface RevenueParkOption {
  label: string;
  value: RevenueParkOptionValue;
}

type RevenueParkOptionValue = 'all' | number;

interface WorkItemRoute {
  names?: string[];
  path: string;
  query?: Record<string, number | string>;
}

type WorkItemTone = 'amber' | 'blue' | 'cyan' | 'orange' | 'red' | 'slate';

interface WorkItemDefinition {
  badge?: () => string;
  emptyText?: string;
  homeTitle?: string;
  icon: string;
  key: string;
  route: WorkItemRoute;
  summary?: () => string;
  title: string;
  todoTypes?: DashboardWorkbenchTodoType[];
  tone?: WorkItemTone;
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

const TODO_PANEL_ITEM_KEYS = [
  'rent-unreceived',
  'contract-expiry',
  'pending-reimbursement',
  'reimbursement-audit',
  'investment-leads',
  'vacant-factory',
  'maintenance-orders',
  'attendance-abnormal',
] as const;

function createEmptyRevenueOverview(): RevenueOverview {
  return {
    periodLabel: '',
    receivableTotal: 0,
    receivedTotal: 0,
    remainingTotal: 0,
    trend: [],
  };
}

function createDefaultRevenueDates(): [Dayjs, Dayjs] {
  const today = dayjs();
  return [today.startOf('month'), today];
}

function cloneRevenueDates(dates: [Dayjs, Dayjs]): [Dayjs, Dayjs] {
  return [dates[0], dates[1]];
}

const loading = ref(true);
const PRIORITY_TODO_LIMIT = 6;
const WORKBENCH_PREVIEW_REFRESH_INTERVAL = 3 * 60 * 60 * 1000;
const route = useRoute();
const router = useRouter();
const accessStore = useAccessStore();
const authStore = useAuthStore();
const userStore = useUserStore();
const reimburse = ref({ approved: 0, pending: 0, rejected: 0, total: 0 });
const revenueStats = ref<RevenueOverview>(createEmptyRevenueOverview());
const revenueLoading = ref(false);
const defaultRevenueDates = createDefaultRevenueDates();
const revenueDraftDates = ref<[Dayjs, Dayjs]>(
  cloneRevenueDates(defaultRevenueDates),
);
const revenueAppliedDates = ref<[Dayjs, Dayjs]>(
  cloneRevenueDates(defaultRevenueDates),
);
const revenueDraftParkId = ref<RevenueParkOptionValue>('all');
const revenueAppliedParkId = ref<RevenueParkOptionValue>('all');
const revenueParkOptions = ref<RevenueParkOption[]>([
  { label: '全部园区', value: 'all' },
]);
const workbenchTodoSections = ref<DashboardWorkbenchTodoSection[]>([]);
const checkIn = ref<CheckInPreview>({
  hasSignedIn: false,
  punchIn: '',
  punchOut: '',
});
const isAuthenticated = computed(() => Boolean(accessStore.accessToken));
const hasResolvedUserInfo = computed(() => Boolean(userStore.userInfo));
const isWaitingForSession = computed(
  () =>
    route.path === '/home' &&
    isAuthenticated.value &&
    !hasResolvedUserInfo.value,
);
const canFetchPreviewData = computed(
  () =>
    route.path === '/home' &&
    isAuthenticated.value &&
    hasResolvedUserInfo.value,
);
const revenueDateRange = computed(() => {
  const [startDate, endDate] = revenueAppliedDates.value;
  return {
    endDate: endDate.format('YYYY-MM-DD'),
    startDate: startDate.format('YYYY-MM-DD'),
  };
});
const revenueAppliedParkLabel = computed(
  () =>
    revenueParkOptions.value.find(
      (option) => option.value === revenueAppliedParkId.value,
    )?.label || '全部园区',
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
const workbenchTodoSectionMap = computed(() => {
  return new Map(
    workbenchTodoSections.value.map((section) => [section.key, section]),
  );
});
const attendanceItem = computed(() => WORK_ITEM_DEFINITIONS.attendance!);
const todoPanelItems = computed<WorkItemDefinition[]>(() => {
  const roleAllowedKeys = new Set(roleWorkItemKeys.value);
  const items: WorkItemDefinition[] = [];
  for (const key of TODO_PANEL_ITEM_KEYS) {
    const item = WORK_ITEM_DEFINITIONS[key];
    if (item && roleAllowedKeys.has(item.key)) {
      items.push(item);
    }
  }
  return items;
});
const todoPanelTotal = computed(() =>
  todoPanelItems.value.reduce(
    (total, item) => total + getWorkItemCount(item),
    0,
  ),
);
const priorityTodoItems = computed<DashboardWorkbenchTodo[]>(() => {
  const visibleTypes = new Set<DashboardWorkbenchTodoType>();
  for (const item of todoPanelItems.value) {
    for (const type of item.todoTypes ?? []) {
      visibleTypes.add(type);
    }
  }

  const visibleSections = workbenchTodoSections.value
    .filter((section) => visibleTypes.has(section.key))
    .map((section) => ({
      ...section,
      items: [...section.items].sort(compareDashboardTodo),
    }))
    .filter((section) => section.items.length > 0)
    .sort((first, second) =>
      compareDashboardTodo(first.items[0]!, second.items[0]!),
    );
  const prioritySections = visibleSections.filter(
    (section) => section.items[0]!.priority !== 'normal',
  );
  const representativeSections =
    prioritySections.length > 0 ? prioritySections : visibleSections;
  const selectedTodos = new Map<string, DashboardWorkbenchTodo>();

  for (const section of representativeSections) {
    if (selectedTodos.size >= PRIORITY_TODO_LIMIT) {
      break;
    }
    selectedTodos.set(section.items[0]!.todoId, section.items[0]!);
  }

  if (selectedTodos.size < PRIORITY_TODO_LIMIT) {
    const remainingTodos = visibleSections
      .flatMap((section) => section.items)
      .sort(compareDashboardTodo);

    for (const todo of remainingTodos) {
      if (selectedTodos.size >= PRIORITY_TODO_LIMIT) {
        break;
      }
      selectedTodos.set(todo.todoId, todo);
    }
  }

  return [...selectedTodos.values()].sort(compareDashboardTodo);
});
const priorityTodoSummary = computed(() => {
  const moduleCount = new Set(priorityTodoItems.value.map((todo) => todo.type))
    .size;
  const urgentCount = priorityTodoItems.value.filter(
    (todo) => todo.priority === 'urgent',
  ).length;
  const warningCount = priorityTodoItems.value.filter(
    (todo) => todo.priority === 'warning',
  ).length;
  const normalCount =
    priorityTodoItems.value.length - urgentCount - warningCount;
  const summaryParts: string[] = [];

  if (moduleCount > 0) {
    summaryParts.push(`${moduleCount} 个模块`);
  }
  if (urgentCount > 0) {
    summaryParts.push(`${urgentCount} 条紧急`);
  }
  if (warningCount > 0) {
    summaryParts.push(`${warningCount} 条关注`);
  }
  if (normalCount > 0) {
    summaryParts.push(`${normalCount} 条常规`);
  }

  return summaryParts.join(' / ');
});
const revenueMetrics = computed<RevenueMetric[]>(() => [
  {
    dotClass: 'bg-sky-500',
    key: 'receivable',
    label: '应收合计',
    value: revenueStats.value.receivableTotal,
  },
  {
    dotClass: 'bg-emerald-500',
    key: 'received',
    label: '实收合计',
    value: revenueStats.value.receivedTotal,
  },
  {
    dotClass: 'bg-rose-500',
    key: 'remaining',
    label: '未收合计',
    value: revenueStats.value.remainingTotal,
  },
]);
const revenueMaxAmount = computed(() => {
  let maxAmount = 0;
  for (const point of revenueStats.value.trend) {
    maxAmount = Math.max(
      maxAmount,
      point.receivable,
      point.received,
      point.remaining,
    );
  }
  return Math.max(maxAmount, 1);
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
    homeTitle: '考勤异常',
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
    tone: 'orange',
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
    homeTitle: '合同到期提醒',
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
    tone: 'amber',
  },
  'customer-registration': {
    icon: 'mdi:account-plus-outline',
    key: 'customer-registration',
    route: {
      names: ['InvestmentAgentMobileList', 'InvestmentAgent'],
      path: '/investment/mobile',
      query: {
        todoView: 'followup',
      },
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
    homeTitle: '招商线索',
    icon: 'mdi:radar',
    key: 'investment-leads',
    route: {
      names: ['InvestmentAgentMobileList', 'InvestmentAgent'],
      path: '/investment/mobile',
      query: {
        todoView: 'followup',
      },
    },
    title: '招商线索',
    todoTypes: ['investment_lead'],
    tone: 'cyan',
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
    homeTitle: '维护工单',
    icon: 'mdi:clipboard-text-clock',
    key: 'maintenance-orders',
    route: {
      names: ['RepairOrderMobile', 'RepairOrder'],
      path: '/maintenance/repair-order/mobile',
      query: {
        todoView: 'processing',
      },
    },
    title: '维护工单',
    todoTypes: ['repair_order'],
    tone: 'slate',
  },
  'pending-reimbursement': {
    badge: () =>
      reimburse.value.pending > 0 ? `${reimburse.value.pending} 条` : '',
    homeTitle: '待处理报销',
    icon: 'mdi:file-document-alert-outline',
    key: 'pending-reimbursement',
    route: {
      names: ['ReimbursementMobileAudit', 'ReimbursementAudit'],
      path: '/reimbursement/mobile-audit',
      query: {
        status: 0,
      },
    },
    summary: () =>
      reimburse.value.pending > 0
        ? `${reimburse.value.pending} 条报销待处理`
        : '暂无待处理报销',
    title: '待处理报销',
    todoTypes: ['reimbursement_audit'],
    tone: 'blue',
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
    homeTitle: '待处理报销',
    icon: 'mdi:file-check-outline',
    key: 'reimbursement-audit',
    route: {
      names: ['ReimbursementMobileAudit', 'ReimbursementAudit'],
      path: '/reimbursement/mobile-audit',
      query: {
        status: 0,
      },
    },
    summary: () =>
      reimburse.value.pending > 0
        ? `${reimburse.value.pending} 条待审核`
        : '查看报销审核',
    title: '报销审核',
    todoTypes: ['reimbursement_audit'],
    tone: 'blue',
  },
  'rent-unreceived': {
    badge: () => getTodoBadge(['rent_unreceived']),
    emptyText: '暂无未收租账单',
    homeTitle: '未收租提醒',
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
    tone: 'red',
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
    homeTitle: '空置厂房',
    icon: 'mdi:office-building-marker-outline',
    key: 'vacant-factory',
    route: {
      names: ['FactoryList'],
      path: '/rental/factory',
    },
    title: '空置厂房',
    todoTypes: ['vacant_factory'],
    tone: 'orange',
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
    void refreshRevenueParkOptions();
    void fetchPreviewData({ showLoading: false });
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
      refreshTodayAttendance(),
    ]);
    await Promise.allSettled([
      refreshRevenueStats(),
      refreshWorkbenchTodos(options.forceTodos),
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

async function refreshRevenueStats() {
  revenueLoading.value = true;
  try {
    const { endDate, startDate } = revenueDateRange.value;
    const stats = await getDashboardRevenueStats({
      endDate,
      parkId: revenueAppliedParkId.value,
      startDate,
    });
    revenueStats.value = normalizeRevenueStats(stats);
  } catch (error) {
    console.error('revenue stats failed', error);
    revenueStats.value = createEmptyRevenueOverview();
  } finally {
    revenueLoading.value = false;
  }
}

async function refreshRevenueParkOptions() {
  try {
    const list = await getParkList();
    const options = Array.isArray(list)
      ? list
          .map((item: any) => ({
            label: String(item.parkName || item.name || '').trim(),
            value: Number(item.parkId ?? item.id),
          }))
          .filter(
            (item): item is { label: string; value: number } =>
              Boolean(item.label) &&
              Number.isInteger(item.value) &&
              item.value > 0,
          )
      : [];
    revenueParkOptions.value = [
      { label: '全部园区', value: 'all' },
      ...options,
    ];
    if (
      !revenueParkOptions.value.some(
        (option) => option.value === revenueDraftParkId.value,
      )
    ) {
      revenueDraftParkId.value = 'all';
    }
    if (
      !revenueParkOptions.value.some(
        (option) => option.value === revenueAppliedParkId.value,
      )
    ) {
      revenueAppliedParkId.value = 'all';
    }
  } catch (error) {
    console.error('revenue park options failed', error);
    revenueParkOptions.value = [{ label: '全部园区', value: 'all' }];
    revenueDraftParkId.value = 'all';
    revenueAppliedParkId.value = 'all';
  }
}

function normalizeRevenuePickerDate(
  value: Dayjs | null | string | undefined,
  fallback: Dayjs,
) {
  if (dayjs.isDayjs(value)) {
    return value;
  }
  if (typeof value === 'string' && value) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed : fallback;
  }
  return fallback;
}

function updateRevenueStartDate(value: Dayjs | null | string) {
  const startDate = normalizeRevenuePickerDate(
    value,
    revenueDraftDates.value[0] || dayjs(),
  );
  const endDate = revenueDraftDates.value[1];
  revenueDraftDates.value = [
    startDate,
    endDate.isBefore(startDate, 'day') ? startDate : endDate,
  ];
}

function updateRevenueEndDate(value: Dayjs | null | string) {
  const startDate = revenueDraftDates.value[0];
  const endDate = normalizeRevenuePickerDate(
    value,
    revenueDraftDates.value[1] || dayjs(),
  );
  revenueDraftDates.value = [
    startDate.isAfter(endDate, 'day') ? endDate : startDate,
    endDate,
  ];
}

function disabledRevenueFutureDate(current?: Dayjs) {
  return Boolean(current && current.isAfter(dayjs(), 'day'));
}

function disabledRevenueEndDate(current?: Dayjs) {
  return Boolean(
    current &&
    (disabledRevenueFutureDate(current) ||
      current.isBefore(revenueDraftDates.value[0], 'day')),
  );
}

function applyRevenueFilter() {
  revenueAppliedDates.value = cloneRevenueDates(revenueDraftDates.value);
  revenueAppliedParkId.value = revenueDraftParkId.value;
  void refreshRevenueStats();
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
    void refreshRevenueParkOptions();
    void fetchPreviewData({ showLoading: false });
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

async function goRevenueMetric(metric: RevenueMetric) {
  const routePath = '/bill/mobile-list';
  if (!(await requireLogin(router, routePath))) {
    return;
  }

  const { endDate, startDate } = revenueDateRange.value;
  const query: Record<string, number | string> = {
    projectEndDate: endDate,
    projectStartDate: startDate,
  };
  if (revenueAppliedParkId.value !== 'all') {
    query.parkId = revenueAppliedParkId.value;
  }
  if (metric.key === 'remaining') {
    query.collectionStatus = 'unreceived';
  }

  await pushAvailableRoute({
    names: ['BillMobileList', 'Bill'],
    path: routePath,
    query,
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

function normalizeRevenueStats(stats?: DashboardRevenueStats): RevenueOverview {
  const receivableTotal = normalizeRevenueAmount(
    stats?.summary.receivableTotal ?? stats?.summary.expenseTotal,
  );
  const receivedTotal = normalizeRevenueAmount(
    stats?.summary.receivedTotal ?? stats?.summary.incomeTotal,
  );
  const remainingTotal = normalizeRevenueAmount(
    stats?.summary.remainingTotal ??
      Math.max(receivableTotal - receivedTotal, 0),
  );
  const months =
    stats && Array.isArray(stats.trend.months) ? stats.trend.months : [];
  const receivableValues =
    stats?.trend.receivable ?? stats?.trend.expense ?? [];
  const receivedValues = stats?.trend.received ?? stats?.trend.income ?? [];
  const remainingValues = stats?.trend.remaining ?? [];
  const trend: RevenueTrendPoint[] = [];

  for (const [index, label] of months.entries()) {
    trend.push({
      label,
      receivable: getRevenueTrendValue(receivableValues, index),
      received: getRevenueTrendValue(receivedValues, index),
      remaining: getRevenueTrendValue(remainingValues, index),
    });
  }

  if (trend.length === 0) {
    trend.push({
      label: dayjs(revenueDateRange.value.endDate).format('YYYY-MM'),
      receivable: receivableTotal,
      received: receivedTotal,
      remaining: remainingTotal,
    });
  }

  return {
    periodLabel: stats?.periodLabel || formatRevenuePeriodLabel(),
    receivableTotal,
    receivedTotal,
    remainingTotal,
    trend,
  };
}

function normalizeRevenueAmount(value?: number) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getRevenueTrendValue(values: number[], index: number) {
  return normalizeRevenueAmount(values[index]);
}

function formatRevenuePeriodLabel() {
  const { endDate, startDate } = revenueDateRange.value;
  return `${dayjs(startDate).format('YYYY年M月D日')}-${dayjs(endDate).format(
    'YYYY年M月D日',
  )}`;
}

function formatRevenueAmount(value: number) {
  return `${normalizeRevenueAmount(value).toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}元`;
}

function getRevenueBarHeight(value: number) {
  const amount = normalizeRevenueAmount(value);
  if (amount <= 0) {
    return '0%';
  }

  const percent = (amount / revenueMaxAmount.value) * 100;
  return `${Math.min(Math.max(percent, 8), 100).toFixed(2)}%`;
}

function revenueMetricCardClass(metric: RevenueMetric) {
  switch (metric.key) {
    case 'received': {
      return 'border-emerald-100 bg-emerald-50/70 shadow-emerald-100/70 dark:border-emerald-900/50 dark:bg-emerald-950/20';
    }
    case 'remaining': {
      return 'border-rose-100 bg-rose-50/70 shadow-rose-100/70 dark:border-rose-900/50 dark:bg-rose-950/20';
    }
    default: {
      return 'border-sky-100 bg-sky-50/70 shadow-sky-100/70 dark:border-sky-900/50 dark:bg-sky-950/20';
    }
  }
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

function getDashboardTodoPriorityWeight(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') {
    return 0;
  }
  if (priority === 'warning') {
    return 1;
  }
  return 2;
}

function getDashboardTodoRiskScore(todo: DashboardWorkbenchTodo) {
  const riskScore = todo.meta?.riskScore;
  return typeof riskScore === 'number' && Number.isFinite(riskScore)
    ? riskScore
    : 0;
}

function compareDashboardTodo(
  first: DashboardWorkbenchTodo,
  second: DashboardWorkbenchTodo,
) {
  const priorityDiff =
    getDashboardTodoPriorityWeight(first.priority) -
    getDashboardTodoPriorityWeight(second.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const riskDiff =
    getDashboardTodoRiskScore(second) - getDashboardTodoRiskScore(first);
  if (riskDiff !== 0) {
    return riskDiff;
  }

  const firstTime = dayjs(first.dueTime || first.createTime || 0).valueOf();
  const secondTime = dayjs(second.dueTime || second.createTime || 0).valueOf();
  return firstTime - secondTime;
}

function getDashboardTodoPriorityText(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') {
    return '紧急处理';
  }
  if (priority === 'warning') {
    return '重点关注';
  }
  return '常规处理';
}

function getDashboardTodoPriorityClass(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') {
    return 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/50';
  }
  if (priority === 'warning') {
    return 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/50';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700';
}

function getDashboardTodoRailClass(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') {
    return 'bg-rose-500';
  }
  if (priority === 'warning') {
    return 'bg-amber-400';
  }
  return 'bg-slate-300 dark:bg-slate-600';
}

function getDashboardTodoIndexClass(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') {
    return 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/60';
  }
  if (priority === 'warning') {
    return 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60';
  }
  return 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700';
}

function getDashboardTodoActionClass(
  priority: DashboardWorkbenchTodo['priority'],
) {
  if (priority === 'urgent') {
    return 'bg-rose-50 text-rose-600 ring-rose-100 group-active:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/60';
  }
  if (priority === 'warning') {
    return 'bg-amber-50 text-amber-600 ring-amber-100 group-active:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200 group-active:bg-slate-200 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700';
}

function getDashboardTodoTypeClass(type: DashboardWorkbenchTodoType) {
  if (type === 'rent_unreceived') {
    return 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/60';
  }
  if (type === 'reimbursement_audit') {
    return 'bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900/60';
  }
  if (type === 'investment_lead') {
    return 'bg-cyan-50 text-cyan-600 ring-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-300 dark:ring-cyan-900/60';
  }
  if (type === 'contract_expire') {
    return 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900/60';
  }
  if (type === 'repair_order') {
    return 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700';
  }
  if (type === 'attendance_abnormal') {
    return 'bg-orange-50 text-orange-600 ring-orange-100 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900/60';
  }
  return 'bg-teal-50 text-teal-600 ring-teal-100 dark:bg-teal-950/30 dark:text-teal-300 dark:ring-teal-900/60';
}

function getDashboardTodoTimeText(todo: DashboardWorkbenchTodo) {
  const value = todo.dueTime || todo.createTime;
  if (!value) {
    return '';
  }

  const date = dayjs(value);
  if (!date.isValid()) {
    return '';
  }

  return `${todo.dueTime ? '到期' : '提交'} ${date.format('M月D日')}`;
}

function getDashboardTodoMetaItems(todo: DashboardWorkbenchTodo) {
  return [todo.parkName, getDashboardTodoTimeText(todo)].filter(Boolean);
}

function getWorkItemCount(item: WorkItemDefinition) {
  if (
    item.key === 'pending-reimbursement' ||
    item.key === 'reimbursement-audit'
  ) {
    return reimburse.value.pending;
  }

  return getTodoCount(item.todoTypes);
}

function getWorkItemTitle(item: WorkItemDefinition) {
  return item.homeTitle || item.title;
}

function getWorkItemBadge(item: WorkItemDefinition) {
  const count = getWorkItemCount(item);
  if (count <= 0) {
    return '';
  }
  return count > 999 ? '999+' : String(count);
}

function tileCardClass(item: WorkItemDefinition) {
  switch (item.tone) {
    case 'amber': {
      return 'border-amber-100 bg-amber-50/70 shadow-amber-100/70 dark:border-amber-900/50 dark:bg-amber-950/20';
    }
    case 'cyan': {
      return 'border-cyan-100 bg-cyan-50/70 shadow-cyan-100/70 dark:border-cyan-900/50 dark:bg-cyan-950/20';
    }
    case 'orange': {
      return 'border-orange-100 bg-orange-50/70 shadow-orange-100/70 dark:border-orange-900/50 dark:bg-orange-950/20';
    }
    case 'red': {
      return 'border-red-100 bg-red-50/70 shadow-red-100/70 dark:border-red-900/50 dark:bg-red-950/20';
    }
    case 'slate': {
      return 'border-slate-200 bg-slate-50/80 shadow-slate-200/70 dark:border-slate-700 dark:bg-slate-800/80';
    }
    default: {
      return 'border-sky-100 bg-sky-50/70 shadow-sky-100/70 dark:border-sky-900/50 dark:bg-sky-950/20';
    }
  }
}

function tileIconClass(item: WorkItemDefinition) {
  switch (item.tone) {
    case 'amber': {
      return 'border-amber-100 bg-amber-100 text-amber-600 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200';
    }
    case 'cyan': {
      return 'border-cyan-100 bg-cyan-100 text-cyan-600 dark:border-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200';
    }
    case 'orange': {
      return 'border-orange-100 bg-orange-100 text-orange-600 dark:border-orange-800 dark:bg-orange-900/50 dark:text-orange-200';
    }
    case 'red': {
      return 'border-red-100 bg-red-100 text-red-600 dark:border-red-800 dark:bg-red-900/50 dark:text-red-200';
    }
    case 'slate': {
      return 'border-slate-200 bg-slate-200 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200';
    }
    default: {
      return 'border-sky-100 bg-sky-100 text-sky-600 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-200';
    }
  }
}

function tileBadgeClass(item: WorkItemDefinition) {
  switch (item.tone) {
    case 'amber':
    case 'orange': {
      return 'bg-orange-500 text-white';
    }
    case 'red': {
      return 'bg-rose-500 text-white';
    }
    case 'slate': {
      return 'bg-slate-500 text-white';
    }
    default: {
      return 'bg-sky-500 text-white';
    }
  }
}

function hasAnyRole(aliases: readonly string[]) {
  return roleNames.value.some((role) =>
    aliases.some((alias) => role.toLowerCase().includes(alias.toLowerCase())),
  );
}
</script>

<template>
  <div class="dark:bg-background min-h-full bg-[#f5f7fb] px-4 pb-24 pt-5">
    <template v-if="loading || isWaitingForSession">
      <div class="mx-auto max-w-[420px] space-y-4">
        <div
          v-for="n in 3"
          :key="n"
          class="rounded-2xl bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700/70"
        >
          <Skeleton active :paragraph="{ rows: n === 1 ? 2 : 4 }" />
        </div>
      </div>
    </template>

    <template v-else>
      <div class="mx-auto flex max-w-[420px] flex-col gap-4">
        <button
          type="button"
          class="group relative order-1 w-full overflow-hidden rounded-2xl border border-cyan-100/80 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-3 text-left shadow-[0_12px_28px_rgba(45,212,191,0.14)] ring-1 ring-cyan-50 transition-all duration-200 active:scale-[0.99] dark:border-slate-600/80 dark:from-slate-800/95 dark:via-slate-800/95 dark:to-emerald-950/40 dark:ring-slate-700/60"
          @click="goWorkItem(attendanceItem)"
        >
          <div
            class="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-200/20 via-transparent to-emerald-200/30"
          ></div>
          <div class="relative z-10 flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-sky-100 bg-sky-50 text-[15px] text-sky-500 dark:border-cyan-700/60 dark:bg-slate-700/80 dark:text-sky-300"
              >
                <VbenIcon icon="mdi:calendar-check-outline" />
              </span>
              <span
                class="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100"
              >
                考勤打卡
              </span>
            </div>
            <span
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              :class="
                checkIn.hasSignedIn
                  ? 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-amber-100/90 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
              "
            >
              <span class="h-[7px] w-[7px] rounded-full bg-current"></span>
              {{ checkInStatusText }}
            </span>
          </div>

          <div class="relative z-10 mt-2.5 grid grid-cols-2 gap-2">
            <div
              class="rounded-[10px] border border-slate-200/90 bg-white/75 px-[9px] py-[7px] dark:border-slate-600/80 dark:bg-slate-800/70"
            >
              <div class="text-[11px] text-slate-500 dark:text-slate-400">
                上班打卡
              </div>
              <div
                class="mt-0.5 text-[13px] font-bold text-slate-900 dark:text-slate-50"
              >
                {{ checkIn.punchIn || '--:--:--' }}
              </div>
            </div>
            <div
              class="rounded-[10px] border border-slate-200/90 bg-white/75 px-[9px] py-[7px] dark:border-slate-600/80 dark:bg-slate-800/70"
            >
              <div class="text-[11px] text-slate-500 dark:text-slate-400">
                下班打卡
              </div>
              <div
                class="mt-0.5 text-[13px] font-bold text-slate-900 dark:text-slate-50"
              >
                {{ checkIn.punchOut || '--:--:--' }}
              </div>
            </div>
          </div>
        </button>

        <section
          class="order-3 rounded-2xl bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700/70"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-sky-100 bg-sky-50 text-[15px] text-sky-500 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
              >
                <VbenIcon icon="mdi:clipboard-list-outline" />
              </span>
              <h2
                class="truncate text-[16px] font-bold text-slate-900 dark:text-slate-100"
              >
                待办事项
              </h2>
            </div>
            <span
              class="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700"
            >
              共 {{ todoPanelTotal }} 条
            </span>
          </div>

          <div v-if="todoPanelItems.length > 0" class="grid grid-cols-3 gap-3">
            <button
              v-for="item in todoPanelItems"
              :key="item.key"
              type="button"
              class="relative flex min-h-[76px] flex-col items-center justify-center rounded-[14px] border px-2 py-3 text-center shadow-sm transition-all duration-200 active:scale-[0.98]"
              :class="tileCardClass(item)"
              @click="goWorkItem(item)"
            >
              <span
                v-if="getWorkItemBadge(item)"
                class="absolute right-2 top-2 min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-4"
                :class="tileBadgeClass(item)"
              >
                {{ getWorkItemBadge(item) }}
              </span>
              <span
                class="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[18px]"
                :class="tileIconClass(item)"
              >
                <VbenIcon :icon="item.icon" />
              </span>
              <span
                class="max-w-full break-words text-[12px] font-semibold leading-[16px] text-slate-800 dark:text-slate-100"
              >
                {{ getWorkItemTitle(item) }}
              </span>
            </button>
          </div>

          <div
            v-if="priorityTodoItems.length > 0"
            class="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700"
          >
            <div class="mb-2.5 flex items-end justify-between gap-3">
              <div class="min-w-0">
                <div
                  class="text-[13px] font-bold text-slate-900 dark:text-slate-100"
                >
                  优先处理
                </div>
                <div
                  class="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500"
                >
                  跨模块急件
                </div>
              </div>
              <span
                class="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-900/70 dark:text-slate-300"
              >
                {{ priorityTodoSummary }}
              </span>
            </div>
            <div
              class="overflow-hidden rounded-[14px] border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900/40"
            >
              <button
                v-for="(todo, index) in priorityTodoItems"
                :key="todo.todoId"
                type="button"
                class="group flex w-full items-stretch border-b border-slate-100 text-left transition-colors duration-200 last:border-b-0 active:bg-slate-50 dark:border-slate-800 dark:active:bg-slate-800/70"
                @click="goTodo(todo)"
              >
                <span
                  class="w-1 shrink-0 self-stretch"
                  :class="getDashboardTodoRailClass(todo.priority)"
                ></span>
                <div class="min-w-0 flex-1 px-2.5 py-2.5">
                  <div class="flex min-w-0 items-center gap-2">
                    <span
                      class="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ring-1"
                      :class="getDashboardTodoIndexClass(todo.priority)"
                    >
                      {{ index + 1 }}
                    </span>
                    <span
                      class="max-w-[72px] shrink-0 truncate rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1"
                      :class="getDashboardTodoTypeClass(todo.type)"
                    >
                      {{ todo.title }}
                    </span>
                    <span
                      class="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-900 dark:text-slate-50"
                    >
                      {{ todo.businessName }}
                    </span>
                    <span
                      class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1"
                      :class="getDashboardTodoPriorityClass(todo.priority)"
                    >
                      {{ getDashboardTodoPriorityText(todo.priority) }}
                    </span>
                  </div>
                  <p
                    class="mt-1 line-clamp-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300"
                  >
                    {{ todo.content }}
                  </p>
                  <div
                    class="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-400 dark:text-slate-500"
                  >
                    <span
                      v-for="metaItem in getDashboardTodoMetaItems(todo)"
                      :key="metaItem"
                      class="min-w-0 truncate"
                    >
                      {{ metaItem }}
                    </span>
                    <a
                      v-if="todo.phoneNumber"
                      :href="`tel:${todo.phoneNumber}`"
                      class="shrink-0 font-semibold text-sky-600 dark:text-sky-300"
                      @click.stop
                    >
                      {{ todo.phoneNumber }}
                    </a>
                  </div>
                </div>
                <span
                  class="mr-2.5 mt-2.5 inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full px-2 text-[11px] font-bold ring-1"
                  :class="getDashboardTodoActionClass(todo.priority)"
                >
                  处理
                  <VbenIcon icon="mdi:chevron-right" />
                </span>
              </button>
            </div>
          </div>

          <div
            v-if="todoPanelItems.length === 0"
            class="rounded-[14px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500 dark:bg-slate-900/70 dark:text-slate-400"
          >
            暂无待办事项
          </div>
        </section>

        <section
          class="order-2 rounded-2xl bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 dark:bg-gray-800 dark:ring-slate-700/70"
        >
          <div class="mb-4 flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-start gap-2">
              <span
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border border-sky-100 bg-sky-50 text-[15px] text-sky-500 dark:border-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
              >
                <VbenIcon icon="mdi:chart-bar" />
              </span>
              <div class="min-w-0">
                <h2
                  class="truncate text-[16px] font-bold text-slate-900 dark:text-slate-100"
                >
                  营收统计
                </h2>
                <p
                  class="mt-1 truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400"
                >
                  {{ revenueStats.periodLabel || formatRevenuePeriodLabel() }}
                </p>
              </div>
            </div>
            <span
              class="max-w-[128px] shrink-0 truncate rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700"
            >
              {{ revenueAppliedParkLabel }}
            </span>
          </div>

          <div class="mb-3 grid grid-cols-2 gap-2">
            <DatePicker
              :value="revenueDraftDates[0]"
              :disabled-date="disabledRevenueFutureDate"
              class="w-full"
              format="YYYY-MM-DD"
              input-read-only
              placeholder="开始日期"
              size="small"
              @update:value="updateRevenueStartDate"
            />
            <DatePicker
              :value="revenueDraftDates[1]"
              :disabled-date="disabledRevenueEndDate"
              class="w-full"
              format="YYYY-MM-DD"
              input-read-only
              placeholder="结束日期"
              size="small"
              @update:value="updateRevenueEndDate"
            />
            <Select
              v-model:value="revenueDraftParkId"
              :options="revenueParkOptions"
              class="col-span-2 w-full"
              placeholder="全部园区"
              size="small"
            />
            <Button
              class="col-span-2"
              type="primary"
              size="small"
              :loading="revenueLoading"
              @click="applyRevenueFilter"
            >
              确定
            </Button>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="metric in revenueMetrics"
              :key="metric.key"
              type="button"
              class="min-h-[72px] rounded-[14px] border px-2.5 py-2.5 text-left shadow-sm transition-all duration-200 active:scale-[0.98]"
              :class="revenueMetricCardClass(metric)"
              @click="goRevenueMetric(metric)"
            >
              <span
                class="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="metric.dotClass"
                ></span>
                <span class="truncate">{{ metric.label }}</span>
              </span>
              <span
                class="mt-1.5 block max-w-full break-words text-[12px] font-bold leading-[16px] text-slate-900 dark:text-slate-50"
              >
                {{ formatRevenueAmount(metric.value) }}
              </span>
            </button>
          </div>

          <div
            class="mt-4 rounded-[14px] bg-slate-50/80 px-3 pb-3 pt-4 dark:bg-slate-900/50"
          >
            <div
              class="relative h-[118px] overflow-hidden border-b border-slate-200 dark:border-slate-700"
            >
              <div
                class="pointer-events-none absolute inset-x-0 top-1/4 border-t border-dashed border-slate-200 dark:border-slate-700/80"
              ></div>
              <div
                class="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200 dark:border-slate-700/80"
              ></div>
              <div
                class="pointer-events-none absolute inset-x-0 top-3/4 border-t border-dashed border-slate-200 dark:border-slate-700/80"
              ></div>
              <div class="relative z-10 flex h-full items-end gap-2">
                <div
                  v-for="point in revenueStats.trend"
                  :key="point.label"
                  class="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    class="flex h-[94px] w-full items-end justify-center gap-1"
                  >
                    <span
                      class="w-[9px] rounded-t bg-sky-400"
                      :style="{ height: getRevenueBarHeight(point.receivable) }"
                    ></span>
                    <span
                      class="w-[9px] rounded-t bg-emerald-400"
                      :style="{ height: getRevenueBarHeight(point.received) }"
                    ></span>
                    <span
                      class="w-[9px] rounded-t bg-rose-400"
                      :style="{ height: getRevenueBarHeight(point.remaining) }"
                    ></span>
                  </div>
                  <span
                    class="max-w-full truncate text-[10px] leading-4 text-slate-500 dark:text-slate-400"
                  >
                    {{ point.label }}
                  </span>
                </div>
              </div>
            </div>

            <div
              class="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400"
            >
              <span class="inline-flex items-center gap-1">
                <span class="h-2 w-3 rounded-sm bg-sky-400"></span>
                应收合计
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="h-2 w-3 rounded-sm bg-emerald-400"></span>
                实收合计
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="h-2 w-3 rounded-sm bg-rose-400"></span>
                未收合计
              </span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
