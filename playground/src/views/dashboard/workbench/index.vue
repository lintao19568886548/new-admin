<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Empty, Input } from 'ant-design-vue';

import { useAuthStore } from '#/store';
import { useMenuStore } from '#/store/menu';
import { requireLogin } from '#/utils/require-login';

interface NavItem {
  bgClass: string;
  color: string;
  glowClass: string;
  icon: string;
  name: string;
  order: number;
  path: string;
  targetName?: string;
  targetPath: string;
  title: string;
}

interface NavVisualTheme {
  bgClass: string;
  color: string;
  glowClass: string;
}

interface NavGroup {
  icon: string;
  items: NavItem[];
  key: string;
  order: number;
  title: string;
}

interface GroupSeed {
  entries: WorkbenchEntrySeed[];
  icon: string;
  key: string;
  order: number;
  title: string;
}

interface WorkbenchEntrySeed {
  icon: string;
  name: string;
  path: string;
  targetName?: string;
  targetPath?: string;
  title: string;
}

interface WorkbenchRoute {
  children?: WorkbenchRoute[];
  meta?: {
    icon?: unknown;
    order?: unknown;
    title?: unknown;
  };
  name?: unknown;
  path: string;
}

const router = useRouter();
const authStore = useAuthStore();
const menuStore = useMenuStore();
const searchQuery = ref('');

const WORKBENCH_GROUPS: GroupSeed[] = [
  {
    entries: [
      {
        icon: 'lucide:area-chart',
        name: 'Analytics',
        path: '/analytics',
        title: '总览页',
      },
      {
        icon: 'mdi:account-group-outline',
        name: 'ProfileVipMembership',
        path: '/profile/vip-membership',
        title: '创建内部团队',
      },
      {
        icon: 'mdi:account-plus-outline',
        name: 'CrmQrcodeTest',
        path: '/crm/qrcode-test',
        title: '获客推广',
      },
    ],
    icon: 'lucide:layout-dashboard',
    key: 'dashboard',
    order: 1,
    title: '总台',
  },
  {
    entries: [
      {
        icon: 'mdi:view-list',
        name: 'SystemPark',
        path: '/system/park',
        targetName: 'SystemParkMobile',
        targetPath: '/system/park/mobile',
        title: '园区列表',
      },
      {
        icon: 'mdi:factory',
        name: 'FactoryList',
        path: '/rental/factory',
        title: '待租厂房',
      },
      {
        icon: 'mdi:account-group',
        name: 'TenantManage',
        path: '/rental/tenant',
        targetName: 'TenantMobileList',
        targetPath: '/rental/tenant/mobile',
        title: '合同管理',
      },
      {
        icon: 'mdi:bullhorn-outline',
        name: 'Notices',
        path: '/notices',
        targetName: 'NoticesMobile',
        targetPath: '/notices/mobile',
        title: '招投标信息',
      },
    ],
    icon: 'mdi:home-city-outline',
    key: 'rental',
    order: 2,
    title: '租赁管理',
  },
  {
    entries: [
      {
        icon: 'mdi:file-document-check-outline',
        name: 'ReimbursementAudit',
        path: '/reimbursement/audit',
        targetName: 'ReimbursementMobileAudit',
        targetPath: '/reimbursement/mobile-audit',
        title: '报销审核',
      },
      {
        icon: 'mdi:file-document-edit-outline',
        name: 'ReimbursementApplication',
        path: '/reimbursement/application',
        targetName: 'ReimbursementMobileApply',
        targetPath: '/reimbursement/mobile-apply',
        title: '报销申请',
      },
      {
        icon: 'mdi:currency-usd',
        name: 'FinanceManage',
        path: '/finance/manage',
        targetName: 'FinanceMobileManage',
        targetPath: '/finance/mobile-manage',
        title: '财务管理',
      },
      {
        icon: 'mdi:file-document-multiple',
        name: 'Bill',
        path: '/bill',
        targetName: 'BillMobileList',
        targetPath: '/bill/mobile-list',
        title: '智能制单',
      },
    ],
    icon: 'mdi:currency-usd',
    key: 'finance',
    order: 3,
    title: '财务管理',
  },
  {
    entries: [
      {
        icon: 'mdi:flash-triangle',
        name: 'ElectricMeterBrand',
        path: '/smart-meter/electric-brand',
        targetName: 'ElectricMeterBrandMobile',
        targetPath: '/smart-meter/electric-brand/mobile',
        title: '电表品牌管理',
      },
      {
        icon: 'mdi:water-check',
        name: 'WaterMeterBrand',
        path: '/smart-meter/water-brand',
        targetName: 'WaterMeterBrandMobile',
        targetPath: '/smart-meter/water-brand/mobile',
        title: '水表品牌管理',
      },
      {
        icon: 'mdi:flash',
        name: 'SmartMeterElectricReading',
        path: '/smart-meter/meter',
        targetName: 'SmartMeterReadingMobile',
        targetPath: '/smart-meter/reading/mobile',
        title: '水电表抄表数据',
      },
    ],
    icon: 'mdi:gauge',
    key: 'smart-meter',
    order: 4,
    title: '智能抄表',
  },
  {
    entries: [
      {
        icon: 'mdi:card-account-details-outline',
        name: 'HrmAttendancePunch',
        path: '/hrm/attendance/punch',
        title: '出勤打卡',
      },
      {
        icon: 'mdi:map-marker-path',
        name: 'HrmTrajectory',
        path: '/hrm/trajectory',
        title: '考勤轨迹',
      },
      {
        icon: 'mdi:file-document-edit-outline',
        name: 'HrmLeaveApplication',
        path: '/hrm/leaveapplication',
        targetName: 'HrmLeaveApplicationMobile',
        targetPath: '/hrm/leavemobile',
        title: '请假申请',
      },
      {
        icon: 'mdi:account-details-outline',
        name: 'HrmInformation',
        path: '/hrm/information',
        targetName: 'HrmMobileInformation',
        targetPath: '/hrm/mobile-information',
        title: '人员信息',
      },
    ],
    icon: 'mdi:account-group-outline',
    key: 'hrm',
    order: 5,
    title: '人事管理',
  },
  {
    entries: [
      {
        icon: 'lucide:briefcase-business',
        name: 'InvestmentApp',
        path: '/investment/app',
        title: '招商工作台',
      },
      {
        icon: 'mdi:account-tie',
        name: 'InvestmentAgentMobileList',
        path: '/investment/mobile',
        title: '客户登记',
      },
      {
        icon: 'mdi:radar',
        name: 'InvestmentRadarMobileList',
        path: '/investment/radar/mobile',
        title: '智能招商雷达',
      },
      {
        icon: 'mdi:briefcase-search-outline',
        name: 'InvestmentRadarMobilePublicDemands',
        path: '/investment/radar/mobile-public-demands',
        title: '公开需求',
      },
      {
        icon: 'mdi:factory',
        name: 'InvestmentRadarMobileFactoryListings',
        path: '/investment/radar/mobile-factory-listings',
        title: '公开房源',
      },
    ],
    icon: 'lucide:briefcase-business',
    key: 'investment',
    order: 6,
    title: '招商管理',
  },
  {
    entries: [
      {
        icon: 'carbon:badge',
        name: 'AccessBrand',
        path: '/access/brand',
        targetName: 'AccessBrandMobile',
        targetPath: '/access/brand/mobile',
        title: '门禁品牌管理',
      },
      {
        icon: 'carbon:car',
        name: 'CarAccess',
        path: '/access/car',
        targetName: 'CarAccessMobile',
        targetPath: '/access/car/mobile',
        title: '车辆出入管理',
      },
      {
        icon: 'carbon:user-profile',
        name: 'VisitorAccess',
        path: '/access/visitor',
        targetName: 'VisitorMobileList',
        targetPath: '/access/visitor/mobile',
        title: '访客管理',
      },
    ],
    icon: 'lucide:key-square',
    key: 'access',
    order: 7,
    title: '门禁管理',
  },
  {
    entries: [
      {
        icon: 'mdi:lightning-bolt',
        name: 'Transformer',
        path: '/maintenance/transformer',
        targetName: 'TransformerMobile',
        targetPath: '/maintenance/transformer/mobile',
        title: '变压器维保',
      },
      {
        icon: 'mdi:office-building-cog',
        name: 'FactoryMaint',
        path: '/maintenance/factoryMaint',
        targetName: 'FactoryMaintMobile',
        targetPath: '/maintenance/factoryMaint/mobile',
        title: '厂房维护',
      },
      {
        icon: 'mdi:elevator',
        name: 'Elevator',
        path: '/maintenance/elevator',
        targetName: 'ElevatorMobile',
        targetPath: '/maintenance/elevator/mobile',
        title: '电梯管理',
      },
      {
        icon: 'mdi:broom',
        name: 'HygieneCheck',
        path: '/maintenance/hygieneCheck',
        targetName: 'HygieneCheckMobile',
        targetPath: '/maintenance/hygieneCheck/mobile',
        title: '卫生检查',
      },
      {
        icon: 'mdi:fire-extinguisher',
        name: 'Firefighting',
        path: '/maintenance/firefighting',
        targetName: 'FirefightingMobile',
        targetPath: '/maintenance/firefighting/mobile',
        title: '消防管理',
      },
      {
        icon: 'mdi:clipboard-text-clock-outline',
        name: 'RepairOrder',
        path: '/maintenance/repair-order',
        targetName: 'RepairOrderMobile',
        targetPath: '/maintenance/repair-order/mobile',
        title: '报修工单',
      },
    ],
    icon: 'mdi:tools',
    key: 'maintenance',
    order: 8,
    title: '维护管理',
  },
];

const themes: NavVisualTheme[] = [
  {
    bgClass:
      'bg-gradient-to-br from-cyan-100 via-sky-50 to-blue-200 dark:from-cyan-500/35 dark:via-sky-900/55 dark:to-blue-700/35',
    color: 'text-sky-500',
    glowClass:
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_rgba(14,165,233,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_22px_rgba(14,165,233,0.16)]',
  },
  {
    bgClass:
      'bg-gradient-to-br from-emerald-100 via-lime-50 to-green-200 dark:from-emerald-500/35 dark:via-emerald-900/55 dark:to-green-700/35',
    color: 'text-green-500',
    glowClass:
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_rgba(34,197,94,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_22px_rgba(34,197,94,0.16)]',
  },
  {
    bgClass:
      'bg-gradient-to-br from-amber-100 via-orange-50 to-orange-200 dark:from-amber-500/35 dark:via-amber-900/55 dark:to-orange-700/35',
    color: 'text-orange-500',
    glowClass:
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_rgba(249,115,22,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_22px_rgba(249,115,22,0.16)]',
  },
  {
    bgClass:
      'bg-gradient-to-br from-slate-100 via-slate-50 to-slate-300 dark:from-slate-400/30 dark:via-slate-700/80 dark:to-slate-900/90',
    color: 'text-slate-500',
    glowClass:
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_20px_rgba(100,116,139,0.18)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_22px_rgba(15,23,42,0.3)]',
  },
];
const DEFAULT_APP_ICON = 'carbon:application-web';
const DEFAULT_GROUP_ICON = 'carbon:category';

function resolveTitle(metaTitle: unknown, fallback: unknown) {
  let raw = '未命名';
  if (typeof metaTitle === 'string' && metaTitle.length > 0) {
    raw = metaTitle;
  } else if (typeof fallback === 'string' && fallback.length > 0) {
    raw = fallback;
  }
  return $t(raw);
}

function normalizeIcon(icon: unknown, fallback: string) {
  return typeof icon === 'string' && icon.length > 0 ? icon : fallback;
}

function normalizeWorkbenchRoutePath(value: unknown) {
  return String(value || '').replace(/\/+$/, '') || '/';
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

function resolveRoutePath(routePath: string, parentPath?: string) {
  if (!routePath) return parentPath || '';
  if (routePath.startsWith('/')) return normalizeWorkbenchRoutePath(routePath);
  if (!parentPath) return normalizeWorkbenchRoutePath(`/${routePath}`);
  return normalizeWorkbenchRoutePath(`${parentPath}/${routePath}`);
}

function normalizeRoutePath(
  route: WorkbenchRoute,
  parentRoute?: WorkbenchRoute,
) {
  return {
    ...route,
    path: resolveRoutePath(route.path, parentRoute?.path),
  };
}

function collectRoutes(
  routes: WorkbenchRoute[],
  index: Map<string, WorkbenchRoute>,
  parentRoute?: WorkbenchRoute,
) {
  for (const route of routes) {
    const normalizedRoute = normalizeRoutePath(route, parentRoute);
    const routeName = String(normalizedRoute.name || '');
    const routePath = normalizeWorkbenchRoutePath(normalizedRoute.path);
    if (routeName) {
      index.set(`name:${routeName}`, normalizedRoute);
    }
    if (routePath) {
      index.set(`path:${routePath}`, normalizedRoute);
    }
    if (Array.isArray(route.children) && route.children.length > 0) {
      collectRoutes(route.children, index, normalizedRoute);
    }
  }
}

function buildRouteIndex(routes: WorkbenchRoute[]) {
  const index = new Map<string, WorkbenchRoute>();
  collectRoutes(routes, index);
  return index;
}

function findRoute(
  routeIndex: Map<string, WorkbenchRoute>,
  entry: WorkbenchEntrySeed,
) {
  return (
    routeIndex.get(`name:${entry.name}`) ||
    routeIndex.get(`path:${normalizeWorkbenchRoutePath(entry.path)}`)
  );
}

function toNavItem(
  entry: WorkbenchEntrySeed,
  routeIndex: Map<string, WorkbenchRoute>,
  theme: NavVisualTheme,
  order: number,
): NavItem | null {
  const route = findRoute(routeIndex, entry);
  const routePath = normalizeWorkbenchRoutePath(route?.path || entry.path);
  const targetPath = normalizeWorkbenchRoutePath(
    entry.targetPath || route?.path || entry.path,
  );

  return {
    bgClass: theme.bgClass,
    color: theme.color,
    glowClass: theme.glowClass,
    icon: normalizeIcon(entry.icon || route?.meta?.icon, DEFAULT_APP_ICON),
    name: entry.name,
    order,
    path: routePath,
    targetName: entry.targetName,
    targetPath,
    title: entry.title || resolveTitle(route?.meta?.title, entry.name),
  };
}

function buildGroups(routeIndex: Map<string, WorkbenchRoute>) {
  let colorIndex = 0;

  return [...WORKBENCH_GROUPS]
    .sort((a, b) => a.order - b.order)
    .map<NavGroup>((seed) => {
      const items = seed.entries
        .map((entry, index) =>
          toNavItem(
            entry,
            routeIndex,
            themes[colorIndex++ % themes.length] || themes[themes.length - 1]!,
            index + 1,
          ),
        )
        .filter((item): item is NavItem => item !== null);

      const groupRoute = routeIndex.get(`name:${seed.key}`);
      const icon = normalizeIcon(
        seed.icon || groupRoute?.meta?.icon,
        DEFAULT_GROUP_ICON,
      );

      return {
        icon,
        key: seed.key,
        order: seed.order,
        title: seed.title,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

const routeIndex = computed(() =>
  buildRouteIndex(menuStore.menus as WorkbenchRoute[]),
);

const groups = computed(() => buildGroups(routeIndex.value));

const sourceGroups = computed(() => groups.value);

const sortedGroups = computed(() =>
  [...sourceGroups.value].sort((a, b) => a.order - b.order),
);

const filteredGroups = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) return sortedGroups.value;

  return sortedGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        return (
          item.title.toLowerCase().includes(keyword) ||
          item.name.toLowerCase().includes(keyword) ||
          item.path.toLowerCase().includes(keyword) ||
          item.targetPath.toLowerCase().includes(keyword)
        );
      }),
    }))
    .filter((group) => group.items.length > 0);
});

function resolveItemTarget(item: NavItem) {
  if (isMobileViewport()) {
    if (item.targetName && router.hasRoute(item.targetName)) {
      return { name: item.targetName };
    }
    return item.targetPath;
  }

  if (item.name && router.hasRoute(item.name)) {
    return { name: item.name };
  }
  return item.path || item.targetPath;
}

function getLoginRedirectPath(item: NavItem) {
  return isMobileViewport() ? item.targetPath : item.path || item.targetPath;
}

async function handleItemClick(item: NavItem) {
  if (!(await requireLogin(router, getLoginRedirectPath(item)))) {
    return;
  }

  await authStore.ensureSessionReady({ forceRebuildAccess: true });
  const target = resolveItemTarget(item);
  if (!target) return;

  void router.push(target).catch(() => {
    if (item.path) void router.push(item.path);
  });
}
</script>

<template>
  <div class="dark:bg-background min-h-full bg-gray-50 p-4">
    <section
      class="dark:to-slate-900/92 mb-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white/95 to-slate-50/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-5 dark:border-slate-700/90 dark:from-slate-800/95"
    >
      <Input
        v-model:value="searchQuery"
        allow-clear
        :placeholder="$t('请输入关键字搜索应用')"
        class="h-[42px] rounded-[14px] border-slate-300/90 bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-slate-600/90 dark:bg-slate-800/80"
      >
        <template #prefix>
          <VbenIcon icon="carbon:search" class="text-slate-500" />
        </template>
      </Input>
    </section>

    <template v-if="filteredGroups.length > 0">
      <section
        v-for="group in filteredGroups"
        :key="group.key"
        class="dark:to-slate-900/92 mb-4 rounded-2xl border border-slate-200/85 bg-gradient-to-br from-white/95 to-slate-50/95 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.07)] md:p-5 dark:border-slate-700/90 dark:from-slate-800/95"
      >
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span
              class="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-blue-100 text-sky-500 dark:from-cyan-900/50 dark:to-slate-700/85 dark:text-sky-300"
            >
              <VbenIcon :icon="group.icon" class="text-base" />
            </span>
            <div
              class="text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {{ group.title }}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-6">
          <button
            v-for="item in group.items"
            :key="item.name"
            type="button"
            class="dark:from-slate-800/94 dark:to-slate-900/92 flex min-h-20 flex-col items-center justify-center gap-[7px] rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white/95 to-slate-100/95 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_7px_16px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/70 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_18px_rgba(14,165,233,0.2)] dark:border-slate-600/80 dark:shadow-[inset_0_1px_0_rgba(148,163,184,0.1),0_7px_16px_rgba(2,6,23,0.45)] dark:hover:border-sky-400/55 dark:hover:shadow-[inset_0_1px_0_rgba(148,163,184,0.14),0_10px_18px_rgba(56,189,248,0.22)]"
            @click="handleItemClick(item)"
          >
            <span
              class="relative inline-flex h-[40px] w-[40px] items-center justify-center overflow-hidden rounded-xl border border-white/80 dark:border-white/10"
              :class="[item.bgClass, item.glowClass]"
            >
              <span
                class="dark:bg-white/12 pointer-events-none absolute inset-x-1 top-0 h-1/2 rounded-full bg-white/55 blur-md"
              ></span>
              <VbenIcon
                :icon="item.icon"
                class="relative z-10 text-[24px]"
                :class="item.color"
              />
            </span>
            <span
              class="w-full truncate text-center text-[13px] leading-[1.25] text-slate-700 dark:text-slate-200"
            >
              {{ item.title }}
            </span>
          </button>
        </div>
      </section>
    </template>

    <div
      v-else
      class="flex h-24 items-center justify-center rounded-2xl border border-slate-200/85 bg-white/75 dark:border-slate-700/90 dark:bg-slate-800/85"
    >
      <Empty description="暂无匹配的模块" />
    </div>
  </div>
</template>
