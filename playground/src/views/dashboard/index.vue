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

const colors = ['#42a5f5', '#66bb6a', '#ffa726', '#78909c'];
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
            color: colors[colorCounter++ % colors.length] || '#78909c',
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
  if (s.includes('通过')) return 'passed';
  if (s.includes('拒')) return 'rejected';
  return 'pending';
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
            <h1 class="banner-title">工作台</h1>
          </div>
          <p class="banner-subtitle">快速进入应用 · 智能导航 · 科技感满满</p>
          <div class="banner-count">共 {{ totalApps }} 个应用</div>
        </div>
        <div class="banner-search w-full max-w-md sm:w-auto">
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
      <div class="banner-tools">
        <div class="tools-actions">
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
        <div v-if="visibleApps.length > 0" class="tools-grid">
          <div
            v-for="(item, idx) in visibleApps"
            :key="item.title"
            class="tool-item"
            :class="{ 'tool-item-edit': customizeMode }"
            :draggable="customizeMode"
            @dragstart="onDragStart(idx, $event)"
            @dragover="onDragOver"
            @drop="onDrop(idx)"
            @click="!customizeMode && handleItemClick(item.path)"
          >
            <VbenIcon
              :icon="item.icon"
              :style="{ color: item.color }"
              class="tool-icon"
            />
            <div class="tool-title">{{ item.title }}</div>
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
      <div class="info-section">
        <Row :gutter="[16, 16]">
          <Col :lg="12" :md="12" :sm="24" :xs="24">
            <Card class="info-card">
              <div class="info-card-header">
                <div class="info-card-title">报销申请</div>
              </div>
              <div class="info-stats">
                <div class="stat">
                  <div class="stat-value text-blue-600">
                    {{ reimburse.pending }}
                  </div>
                  <div class="stat-label">待处理</div>
                </div>
                <div class="stat">
                  <div class="stat-value text-green-600">
                    {{ reimburse.approved }}
                  </div>
                  <div class="stat-label">已通过</div>
                </div>
                <div class="stat">
                  <div class="stat-value text-red-500">
                    {{ reimburse.rejected }}
                  </div>
                  <div class="stat-label">已拒绝</div>
                </div>
                <div class="stat">
                  <div class="stat-value text-gray-700 dark:text-gray-200">
                    {{ reimburse.total }}
                  </div>
                  <div class="stat-label">总计</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col :lg="12" :md="12" :sm="24" :xs="24">
            <Card class="info-card">
              <div class="info-card-header">
                <div class="info-card-title">访客管理</div>
              </div>
              <div class="visitor-list">
                <div
                  v-for="v in visitors"
                  :key="v.name + v.time"
                  class="visitor-item"
                >
                  <div class="visitor-left">
                    <VbenIcon icon="carbon:user-avatar" class="visitor-icon" />
                  </div>
                  <div class="visitor-right">
                    <div class="visitor-name">{{ v.name }}</div>
                    <div class="visitor-meta">
                      {{ v.time }} · {{ v.reason }}
                    </div>
                  </div>
                  <div class="visitor-status" :class="statusClass(v.status)">
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

.banner-title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  color: rgb(31 41 55);
  letter-spacing: 0.2px;
}

.dark .banner-title {
  color: rgb(229 231 235);
}

.banner-subtitle {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.45;
  color: rgb(75 85 99);
}

.dark .banner-subtitle {
  color: rgb(148 163 184);
}

.banner-count {
  margin-top: 4px;
  font-size: 12px;
  color: rgb(107 114 128);
}

.dark .banner-count {
  color: rgb(156 163 175);
}

.banner-search {
  margin-top: 6px;
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

.banner-tools {
  margin-top: 14px;
}

.info-section {
  margin-top: 8px;
}

.info-card {
  background: rgb(255 255 255 / 80%);
  border-radius: 12px;
}

.dark .info-card {
  background: rgb(31 41 55 / 80%);
}

.info-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.info-card-title {
  font-size: 16px;
  font-weight: 600;
  color: rgb(31 41 55);
}

.dark .info-card-title {
  color: rgb(229 231 235);
}

.info-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.stat {
  padding: 8px 10px;
  text-align: center;
  background: rgb(248 250 252);
  border-radius: 10px;
}

.dark .stat {
  background: rgb(17 24 39);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
}

.stat-label {
  margin-top: 2px;
  font-size: 12px;
  color: rgb(107 114 128);
}

.dark .stat-label {
  color: rgb(156 163 175);
}

.visitor-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.visitor-item {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  background: rgb(248 250 252);
  border: 1px solid rgb(226 232 240);
  border-radius: 10px;
}

.dark .visitor-item {
  background: rgb(17 24 39);
  border-color: rgb(55 65 81);
}

.visitor-icon {
  font-size: 22px;
}

.visitor-name {
  font-weight: 600;
}

.visitor-meta {
  margin-top: 2px;
  font-size: 12px;
  color: rgb(107 114 128);
}

.dark .visitor-meta {
  color: rgb(156 163 175);
}

.visitor-status {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid rgb(226 232 240);
  border-radius: 9999px;
}

.visitor-status.passed {
  color: rgb(22 163 74);
  border-color: rgb(74 222 128 / 50%);
}

.visitor-status.pending {
  color: rgb(234 179 8);
  border-color: rgb(250 204 21 / 50%);
}

.visitor-status.rejected {
  color: rgb(239 68 68);
  border-color: rgb(248 113 113 / 50%);
}

.tools-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 10px;
  touch-action: manipulation;
  cursor: pointer;
  user-select: none;
  background: rgb(248 250 252);
  border: 1px solid rgb(226 232 240);
  border-radius: 12px;
  transition: all 0.15s ease;
}

.tool-item-edit {
  cursor: grab;
  border-style: dashed;
}

.tool-item:hover {
  border-color: rgb(59 130 246 / 50%);
  box-shadow: 0 6px 16px rgb(16 24 40 / 8%);
  transform: translateY(-1px);
}

.dark .tool-item {
  background: rgb(31 41 55);
  border-color: rgb(55 65 81);
}

.tool-icon {
  font-size: 22px;
}

.tool-title {
  max-width: 100%;
  margin-top: 6px;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.25;
  color: rgb(55 65 81);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizelegibility;
}

.dark .tool-title {
  color: rgb(209 213 219);
}

@media (max-width: 1024px) {
  .tools-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .tools-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .tool-item {
    min-height: 56px;
    padding: 12px 8px;
  }

  .tool-icon {
    font-size: 24px;
  }
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

@media (max-width: 420px) {
  .tools-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
