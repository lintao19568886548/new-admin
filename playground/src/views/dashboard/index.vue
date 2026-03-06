<!-- eslint-disable unicorn/no-nested-ternary -->
<script lang="ts" setup>
import type { RouteRecordStringComponent } from '@vben/types';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { VbenIcon } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Button, Card, Col, Empty, Input, Row, Skeleton } from 'ant-design-vue';

import { getVisitorList } from '#/api/access/visitor';
import { getReimbursementList } from '#/api/reimbursement/reimbursement';
import { useMenuStore } from '#/store/menu';

interface NavItem {
  color: string;
  icon: string;
  path: string;
  title: string;
}

interface NavGroup {
  icon: string;
  items: NavItem[];
  title: string;
}

interface VisitorPreview {
  name: string;
  reason?: string;
  status: string;
  time: string;
}

const loading = ref(true);
const router = useRouter();

const colors = [
  'text-sky-500',
  'text-green-500',
  'text-orange-500',
  'text-slate-500',
];
const navGroups = ref<NavGroup[]>([]);
const searchQuery = ref('');
const expanded = ref(false);
const customizeMode = ref(false);
const customOrder = ref<string[]>([]);
const dragFromIndex = ref<null | number>(null);
const ORDER_KEY = 'dashboard_custom_order';
const reimburse = ref({ approved: 0, pending: 0, rejected: 0, total: 0 });
const visitors = ref<VisitorPreview[]>([]);

function collectNavItems(
  menus: RouteRecordStringComponent[],
  result: NavItem[] = [],
) {
  for (const menu of menus) {
    // A menu with children is a sub-group, recurse into it.
    if (menu.children?.length) {
      collectNavItems(menu.children, result);
    } // An item with an icon is a navigable item.
    else if (menu.meta?.icon && menu.meta.isApp) {
      result.push({
        color: '', // Will be assigned later
        icon: menu.meta.icon as string,
        // path is resolved by router, we can use the menu's name for navigation
        path: menu.name as string,
        title: $t(menu.meta.title || 'Unnamed'),
      });
    }
  }
  return result;
}

function buildNavGroups(menus: RouteRecordStringComponent[]): NavGroup[] {
  const groups: NavGroup[] = [];
  let colorCounter = 0;

  for (const menu of menus) {
    if (menu.children?.length) {
      const items = collectNavItems(menu.children);
      if (items.length > 0) {
        groups.push({
          icon: menu.meta?.icon as string,
          title: $t(menu.meta?.title || 'Unnamed'),
          items: items.map((item) => ({
            ...item,
            color: colors[colorCounter++ % colors.length] || 'text-slate-500',
          })),
        });
      }
    }
  }
  return groups;
}

onMounted(() => {
  loading.value = true;
  try {
    const menuStore = useMenuStore();
    navGroups.value = buildNavGroups(menuStore.menus);
  } catch (error) {
    console.error('Failed to load menu items:', error);
  } finally {
    loading.value = false;
  }
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) customOrder.value = arr;
  } catch {}
  fetchPreviewData();
});

async function fetchPreviewData() {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      getReimbursementList({
        pageNo: 1,
        pageSize: 1,
        status: 0,
        type: 'application',
      }),
      getReimbursementList({
        pageNo: 1,
        pageSize: 1,
        status: 1,
        type: 'application',
      }),
      getReimbursementList({
        pageNo: 1,
        pageSize: 1,
        status: 2,
        type: 'application',
      }),
      getReimbursementList({ pageNo: 1, pageSize: 1, type: 'application' }),
    ]);
    reimburse.value = {
      approved: approved?.total || 0,
      pending: pending?.total || 0,
      rejected: rejected?.total || 0,
      total: total?.total || 0,
    };
  } catch (error) {
    console.error('reimbursement stats failed', error);
  }
  try {
    const res = await getVisitorList({
      currentPage: 1,
      currentPark: -1,
      pageSize: 3,
    });
    const items = Array.isArray(res?.items) ? res.items : [];
    visitors.value = items.map((it: any) => {
      const statusNum =
        typeof it.status === 'number'
          ? it.status
          : String(it.status).includes('入')
            ? 0
            : 1;
      return {
        name: it.visitorName,
        reason: it.remark || it.parkName,
        status: statusNum === 0 ? '进入' : '离开',
        time: it.registerTime || it.createTime || '',
      };
    });
  } catch (error) {
    console.error('visitor list failed', error);
    visitors.value = [];
  }
}

const totalApps = computed(() =>
  navGroups.value.reduce((sum, g) => sum + g.items.length, 0),
);

const appsAll = computed(() => navGroups.value.flatMap((g) => g.items));
function applyOrder(items: NavItem[]) {
  const byId: Record<string, NavItem> = {};
  items.forEach((i) => (byId[i.path] = i));
  const ordered: NavItem[] = [];
  for (const id of customOrder.value) {
    if (byId[id]) ordered.push(byId[id]);
  }
  for (const i of items) {
    if (!customOrder.value.includes(i.path)) ordered.push(i);
  }
  return ordered;
}
const appsAllOrdered = computed(() => applyOrder(appsAll.value));
const filteredApps = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const src = appsAllOrdered.value;
  if (!q) return src;
  return src.filter(
    (i) =>
      i.title.toLowerCase().includes(q) || i.path.toLowerCase().includes(q),
  );
});
const visibleApps = computed(() => {
  const list = filteredApps.value;
  return expanded.value ? list : list.slice(0, 6);
});
function saveOrder() {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(customOrder.value));
  } catch {}
}
function onDragStart(index: number, e: DragEvent) {
  dragFromIndex.value = index;
  try {
    e.dataTransfer?.setData('text/plain', String(index));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  } catch {}
}
function onDragOver(e: DragEvent) {
  e.preventDefault();
  try {
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  } catch {}
}
function onDrop(index: number) {
  const from = dragFromIndex.value;
  if (from === null) return;
  const fromId = visibleApps.value[from]?.path;
  const toId = visibleApps.value[index]?.path;
  if (!fromId || !toId || fromId === toId) {
    dragFromIndex.value = null;
    return;
  }
  const ids = appsAllOrdered.value.map((i) => i.path);
  const fromAbs = ids.indexOf(fromId);
  const toAbs = ids.indexOf(toId);
  if (fromAbs === -1 || toAbs === -1) {
    dragFromIndex.value = null;
    return;
  }
  const next = [...ids];
  const moved = next.splice(fromAbs, 1)[0]!;
  next.splice(toAbs, 0, moved);
  customOrder.value = next;
  saveOrder();
  dragFromIndex.value = null;
}

function handleItemClick(name: string) {
  router.push({ name });
}

function statusClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('通过')) return 'text-green-600 border-green-400/50';
  if (s.includes('拒')) return 'text-red-500 border-red-400/50';
  return 'text-amber-500 border-amber-400/50';
}

function goVisitorManagement() {
  router.push({ name: 'VisitorMobileList' });
}
</script>

<template>
  <div class="dark:bg-background min-h-full bg-gray-50 p-4">
    <div
      class="banner relative mb-6 overflow-hidden rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="banner-grid"></div>
      <div class="banner-glow"></div>
      <div
        class="relative z-10 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <VbenIcon
              icon="carbon:dashboard"
              class="text-[22px] text-blue-500"
            />
            <h1
              class="text-[20px] font-bold leading-[1.2] tracking-[0.2px] text-gray-800 dark:text-gray-200"
            >
              工作台
            </h1>
          </div>
          <!-- <p class="banner-subtitle">快速进入应用 · 智能导航 · 科技感满满</p> -->
          <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            共 {{ totalApps }} 个应用
          </div>
        </div>
        <div class="banner-search mt-1.5 w-full max-w-md sm:mt-0 sm:w-auto">
          <Input
            v-model:value="searchQuery"
            allow-clear
            :placeholder="$t('请输入关键字搜索应用')"
          >
            <template #prefix>
              <VbenIcon icon="carbon:search" class="text-gray-500" />
            </template>
          </Input>
        </div>
      </div>
      <div class="mt-3.5">
        <div class="tools-actions mb-2 flex items-center justify-end">
          <div class="mr-auto"></div>
          <Button size="small" @click="expanded = !expanded">
            {{ expanded ? '收起' : '展开更多' }}
          </Button>
          <Button
            size="small"
            type="primary"
            class="ml-2"
            @click="customizeMode = !customizeMode"
          >
            {{ customizeMode ? '完成自定义' : '自定义' }}
          </Button>
        </div>
        <div
          v-if="visibleApps.length > 0"
          class="grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-6"
        >
          <div
            v-for="(item, idx) in visibleApps"
            :key="item.title"
            class="flex min-h-14 touch-manipulation select-none flex-col items-center justify-center rounded-[14px] border border-slate-100 bg-gradient-to-b from-[#f6f9fc] to-[#e9eef5] px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_20px_rgba(0,0,0,0.22)] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:border-[#8bdcff] hover:shadow-[0_8px_22px_rgba(16,24,40,0.22),0_0_14px_rgba(0,200,255,0.4)] md:min-h-0 md:px-3 md:py-3.5 dark:border-gray-700 dark:bg-gradient-to-b dark:from-[#1f2937] dark:to-[#182230]"
            :class="
              customizeMode ? 'cursor-grab border-dashed' : 'cursor-pointer'
            "
            :draggable="customizeMode"
            @dragstart="onDragStart(idx, $event)"
            @dragover="onDragOver"
            @drop="onDrop(idx)"
            @click="!customizeMode && handleItemClick(item.path)"
          >
            <VbenIcon
              :icon="item.icon"
              class="text-[24px] md:text-[22px]"
              :class="item.color"
            />
            <div
              class="mt-1.5 w-full truncate text-center text-[13px] leading-[1.25] text-gray-700 dark:text-gray-300"
            >
              {{ item.title }}
            </div>
          </div>
        </div>
        <div v-else class="flex h-20 items-center justify-center">
          <Empty description="暂无匹配的模块" />
        </div>
      </div>
    </div>
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
          <Col :lg="12" :md="12" :sm="24" :xs="24">
            <Card class="rounded-xl bg-white/80 dark:bg-gray-800/80">
              <div class="mb-2 flex items-center justify-between">
                <div
                  class="text-base font-semibold text-gray-800 dark:text-gray-200"
                >
                  报销申请
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
          </Col>
          <Col :lg="12" :md="12" :sm="24" :xs="24">
            <Card class="rounded-xl bg-white/80 dark:bg-gray-800/80">
              <div class="mb-2 flex items-center justify-between">
                <div
                  class="text-base font-semibold text-gray-800 dark:text-gray-200"
                >
                  访客管理
                </div>
              </div>
              <div class="flex flex-col gap-2.5">
                <div
                  v-for="v in visitors"
                  :key="v.name + v.time"
                  class="grid grid-cols-[36px_1fr_auto] items-center gap-2.5 rounded-xl border border-slate-200 bg-gradient-to-b from-[#f6f9fc] to-[#e9eef5] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_rgba(0,0,0,0.16)] dark:border-gray-700 dark:bg-gradient-to-b dark:from-[#111827] dark:to-[#0f172a]"
                  @click="goVisitorManagement"
                >
                  <div class="visitor-left">
                    <VbenIcon icon="carbon:user-avatar" class="text-[22px]" />
                  </div>
                  <div class="visitor-right">
                    <div class="font-semibold">{{ v.name }}</div>
                    <div
                      class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                    >
                      {{ v.time }} · {{ v.reason }}
                    </div>
                  </div>
                  <div
                    class="rounded-full border border-slate-200 px-2 py-0.5 text-xs"
                    :class="statusClass(v.status)"
                  >
                    {{ v.status }}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </template>
  </div>
</template>

<style scoped>
.banner-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(transparent 1px, rgb(255 255 255 / 4%) 1px),
    linear-gradient(135deg, rgb(66 165 245 / 10%), rgb(169 110 255 / 8%));
  background-size:
    3px 3px,
    100% 100%;
  mix-blend-mode: overlay;
}

.banner-glow {
  position: absolute;
  inset: -20%;
  pointer-events: none;
  background:
    radial-gradient(
      600px 180px at 10% 20%,
      rgb(66 165 245 / 30%),
      transparent 50%
    ),
    radial-gradient(
      600px 180px at 90% 80%,
      rgb(169 110 255 / 25%),
      transparent 50%
    );
  filter: blur(20px);
  opacity: 0.45;
}

:deep(.banner-search .ant-input-affix-wrapper) {
  height: 40px;
  border-radius: 12px;
}

:deep(.banner-search .ant-input-affix-wrapper:hover) {
  border-color: rgb(59 130 246 / 50%);
}

:deep(.banner-search .ant-input-affix-wrapper-focused) {
  border-color: rgb(59 130 246);
  box-shadow: 0 0 0 2px rgb(59 130 246 / 20%);
}

:deep(.tools-actions .ant-btn) {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  line-height: 1;
  white-space: nowrap;
  border-radius: 9999px;
}

:deep(.tools-actions .ant-btn > span) {
  display: inline-flex;
  align-items: center;
}
</style>
