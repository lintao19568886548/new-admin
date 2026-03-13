<script lang="ts" setup>
import type { RouteRecordStringComponent } from '@vben/types';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Empty, Input } from 'ant-design-vue';

import { useMenuStore } from '#/store/menu';

interface NavItem {
  color: string;
  icon: string;
  name: string;
  order: number;
  path: string;
  title: string;
}

interface NavGroup {
  icon: string;
  items: NavItem[];
  key: string;
  order: number;
  title: string;
}

interface GroupSeed {
  icon: string;
  key: string;
  order: number;
  routes: RouteRecordStringComponent[];
  title: string;
}

const router = useRouter();
const searchQuery = ref('');
const groups = ref<NavGroup[]>([]);
const recentNames = ref<string[]>([]);

const colors = [
  'text-sky-500',
  'text-green-500',
  'text-orange-500',
  'text-slate-500',
];
const DEFAULT_APP_ICON = 'carbon:application-web';
const DEFAULT_GROUP_ICON = 'carbon:category';
const RECENT_GROUP_KEY = 'recent';
const RECENT_GROUP_TITLE = '最近使用';
const RECENT_GROUP_ICON = 'carbon:recently-viewed';
const RECENT_STORAGE_KEY = 'workbench_recent_apps';
const MAX_RECENT_ITEMS = 9;

function parseOrder(order: unknown) {
  if (typeof order === 'number' && Number.isFinite(order)) return order;
  if (typeof order === 'string' && order.length > 0) {
    const parsed = Number(order);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

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

function hasChildren(route: RouteRecordStringComponent) {
  return Array.isArray(route.children) && route.children.length > 0;
}

function shouldIncludeAsApp(route: RouteRecordStringComponent) {
  if (hasChildren(route)) return false;
  if (!route.meta?.isApp) return false;
  if (!route.name) return false;
  if (route.name === 'Workbench' || route.path === '/workbench') return false;
  return true;
}

function collectAppRoutes(
  routes: RouteRecordStringComponent[],
  result: RouteRecordStringComponent[] = [],
) {
  for (const route of routes) {
    if (hasChildren(route)) {
      collectAppRoutes(route.children ?? [], result);
      continue;
    }
    if (shouldIncludeAsApp(route)) result.push(route);
  }
  return result;
}

function toNavItem(
  route: RouteRecordStringComponent,
  color: string,
): NavItem | null {
  if (!route.name) return null;
  return {
    color,
    icon: normalizeIcon(route.meta?.icon, DEFAULT_APP_ICON),
    name: String(route.name),
    order: parseOrder(route.meta?.order),
    path: typeof route.path === 'string' ? route.path : '',
    title: resolveTitle(route.meta?.title, route.name),
  };
}

function sortByOrderAndTitle<T extends { order: number; title: string }>(
  arr: T[],
) {
  return [...arr].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title, 'zh-Hans-CN');
  });
}

function buildGroups(menuRoutes: RouteRecordStringComponent[]) {
  const seeds: GroupSeed[] = [];
  const uncategorized: RouteRecordStringComponent[] = [];

  for (const route of menuRoutes) {
    if (hasChildren(route)) {
      const appRoutes = collectAppRoutes(route.children ?? []);
      if (appRoutes.length === 0) continue;
      seeds.push({
        icon: normalizeIcon(route.meta?.icon, DEFAULT_GROUP_ICON),
        key: String(route.name || route.path || route.meta?.title || 'group'),
        order: parseOrder(route.meta?.order),
        routes: appRoutes,
        title: resolveTitle(route.meta?.title, route.name || route.path),
      });
      continue;
    }

    if (shouldIncludeAsApp(route)) uncategorized.push(route);
  }

  if (uncategorized.length > 0) {
    seeds.push({
      icon: DEFAULT_GROUP_ICON,
      key: 'uncategorized',
      order: 99_999,
      routes: uncategorized,
      title: '其他功能',
    });
  }

  const sortedSeeds = sortByOrderAndTitle(
    seeds.map((seed) => ({ ...seed, title: seed.title })),
  );
  let colorIndex = 0;

  return sortedSeeds
    .map<NavGroup>((seed) => {
      const items = sortByOrderAndTitle(
        seed.routes
          .map((route) =>
            toNavItem(
              route,
              colors[colorIndex++ % colors.length] || 'text-slate-500',
            ),
          )
          .filter((item): item is NavItem => item !== null),
      );

      return {
        icon: seed.icon,
        key: seed.key,
        order: seed.order,
        title: seed.title,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

const navItemsMap = computed(() => {
  const map = new Map<string, NavItem>();
  for (const group of groups.value) {
    for (const item of group.items) {
      map.set(item.name, item);
    }
  }
  return map;
});

const recentGroup = computed<NavGroup | null>(() => {
  const items = recentNames.value
    .map((name) => navItemsMap.value.get(name))
    .filter((item): item is NavItem => item !== undefined);

  if (items.length === 0) return null;

  return {
    icon: RECENT_GROUP_ICON,
    key: RECENT_GROUP_KEY,
    order: -99_999,
    title: RECENT_GROUP_TITLE,
    items,
  };
});

const displayGroups = computed<NavGroup[]>(() => {
  if (!recentGroup.value) return groups.value;
  return [recentGroup.value, ...groups.value];
});

const filteredGroups = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) return displayGroups.value;

  return displayGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        return (
          item.title.toLowerCase().includes(keyword) ||
          item.name.toLowerCase().includes(keyword) ||
          item.path.toLowerCase().includes(keyword)
        );
      }),
    }))
    .filter((group) => group.items.length > 0);
});

function loadRecentNames() {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      recentNames.value = [];
      return;
    }
    recentNames.value = parsed
      .filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      )
      .slice(0, MAX_RECENT_ITEMS);
  } catch {
    recentNames.value = [];
  }
}

function persistRecentNames() {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentNames.value));
  } catch {}
}

function addRecentItem(item: NavItem) {
  const next = [
    item.name,
    ...recentNames.value.filter((name) => name !== item.name),
  ];
  recentNames.value = next.slice(0, MAX_RECENT_ITEMS);
  persistRecentNames();
}

onMounted(() => {
  try {
    const menuStore = useMenuStore();
    groups.value = buildGroups(menuStore.menus);
    loadRecentNames();
  } catch (error) {
    console.error('Failed to build workbench navigation:', error);
    groups.value = [];
    recentNames.value = [];
  }
});

function handleItemClick(item: NavItem) {
  addRecentItem(item);
  if (item.name) {
    void router.push({ name: item.name }).catch(() => {
      if (item.path) void router.push(item.path);
    });
    return;
  }

  if (item.path) void router.push(item.path);
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
              class="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-blue-100 text-sky-500 dark:from-cyan-900/50 dark:to-slate-700/85 dark:text-sky-300"
            >
              <VbenIcon :icon="group.icon" class="text-sm" />
            </span>
            <div
              class="text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {{ group.title }}
            </div>
          </div>
          <span
            class="rounded-full border border-slate-300/90 bg-slate-50/85 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-600/85 dark:bg-slate-700/80 dark:text-slate-400"
          >
            {{ group.items.length }} 项
          </span>
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
              class="inline-flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-600/80 dark:to-slate-700/90"
            >
              <VbenIcon
                :icon="item.icon"
                class="text-[21px]"
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
