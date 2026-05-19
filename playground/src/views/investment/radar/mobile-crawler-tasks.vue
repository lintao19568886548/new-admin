<script lang="ts" setup>
import type {
  CrawlerOpsSummary,
  CrawlerSource,
  CrawlerTask,
  CrawlerTaskItem,
  CrawlerTaskLog,
  CrawlerTaskStatus,
} from '#/api/investment';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  ClockCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  message,
  Pagination,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  cancelCrawlerTask,
  getCrawlerOpsSummary,
  getCrawlerSourceList,
  getCrawlerTaskDetail,
  getCrawlerTaskItemList,
  getCrawlerTaskList,
  getCrawlerTaskLogList,
  reclaimStaleCrawlerTaskItems,
  requeueCrawlerTaskItems,
  runCrawlerTask,
  runPublicOpportunityCrawlerTask,
  startPublicOpportunityCrawlerScheduler,
  stopPublicOpportunityCrawlerScheduler,
} from '#/api/investment';

import { formatDateOnly } from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileCrawlerTasks' });

const PUBLIC_FACTORY_LISTING_SOURCE_CODE = 'PUBLIC_FACTORY_LISTING_CFZSW68';
const PUBLIC_OPPORTUNITY_SOURCE_CODE = 'PUBLIC_OPPORTUNITY_99CFW';

const loading = ref(false);
const opsSummaryLoading = ref(false);
const runningDemo = ref(false);
const runningPilot = ref(false);
const schedulerLoading = ref(false);
const reclaimLoading = ref(false);
const requeueLoading = ref(false);
const detailLoading = ref(false);
const logLoading = ref(false);
const itemLoading = ref(false);
const detailOpen = ref(false);
const logOpen = ref(false);
const itemOpen = ref(false);
const filterOpen = ref(false);
const items = ref<CrawlerTask[]>([]);
const opsSummary = ref<CrawlerOpsSummary | null>(null);
const sourceItems = ref<CrawlerSource[]>([]);
const currentTask = ref<CrawlerTask | null>(null);
const logItems = ref<CrawlerTaskLog[]>([]);
const taskItemRows = ref<CrawlerTaskItem[]>([]);

const searchForm = reactive({
  sourceId: undefined as number | undefined,
  status: '',
});

const itemSearchForm = reactive({
  status: '',
});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const itemPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const statusOptions: Array<{ label: string; value: '' | CrawlerTaskStatus }> = [
  { label: '全部', value: '' },
  { label: '待执行', value: 'PENDING' },
  { label: '执行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELED' },
];

const itemStatusOptions = [
  { label: '全部', value: '' },
  { label: '待执行', value: 'PENDING' },
  { label: '执行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '重试等待', value: 'RETRY_WAITING' },
  { label: '失败', value: 'FAILED' },
  { label: '跳过', value: 'SKIPPED' },
];

const sourceOptions = computed(() => [
  { label: '全部数据源', value: undefined },
  ...sourceItems.value.map((source) => ({
    label: `${source.sourceName} (${source.sourceCode})`,
    value: source.sourceId,
  })),
]);

const statusMeta: Record<string, { color: string; label: string }> = {
  CANCELED: { color: 'default', label: '已取消' },
  FAILED: { color: 'red', label: '失败' },
  PENDING: { color: 'orange', label: '待执行' },
  RETRY_WAITING: { color: 'gold', label: '重试等待' },
  RUNNING: { color: 'processing', label: '执行中' },
  SKIPPED: { color: 'default', label: '跳过' },
  SUCCESS: { color: 'green', label: '成功' },
};

const taskTypeLabel: Record<string, string> = {
  PUBLIC_FACTORY_LISTING_URL_BATCH: '公开厂房URL批量采集',
  PUBLIC_OPPORTUNITY_URL_BATCH: '公开机会URL批量采集',
};

const publicOpportunityCanRun = computed(
  () => opsSummary.value?.scheduler.canRunNow !== false,
);

const selectedSource = computed(() =>
  sourceItems.value.find((source) => source.sourceId === searchForm.sourceId),
);

const selectedPublicSourceCode = computed(() => {
  const sourceCode = selectedSource.value?.sourceCode;
  return sourceCode === PUBLIC_FACTORY_LISTING_SOURCE_CODE ||
    sourceCode === PUBLIC_OPPORTUNITY_SOURCE_CODE
    ? sourceCode
    : PUBLIC_OPPORTUNITY_SOURCE_CODE;
});

const activeOpsSourceId = computed(
  () => searchForm.sourceId || opsSummary.value?.source?.sourceId,
);

const visibleRunningTaskCount = computed(
  () => items.value.filter((item) => item.status === 'RUNNING').length,
);

const visibleFailedTaskCount = computed(
  () => items.value.filter((item) => item.status === 'FAILED').length,
);

const visibleUrlIssueCount = computed(() =>
  items.value.reduce(
    (sum, item) =>
      sum +
      (item.failedItemCount || 0) +
      (item.retryWaitingItemCount || 0) +
      (item.skippedItemCount || 0),
    0,
  ),
);

function formatTaskType(taskType?: null | string) {
  if (!taskType) {
    return '-';
  }
  return taskTypeLabel[taskType] || taskType;
}

function formatJsonBlock(value?: null | Record<string, unknown>) {
  return value ? JSON.stringify(value, null, 2) : '-';
}

function formatSourceRef(item: CrawlerTaskItem) {
  return item.sourceRefType || (item.sourceRefId ? '已关联' : '-');
}

function getStatusCount(
  source: null | Record<string, number> | undefined,
  status: string,
) {
  return Number(source?.[status] || 0);
}

function buildQuery() {
  return {
    currentPage: pagination.current,
    pageSize: pagination.pageSize,
    sourceId: searchForm.sourceId,
    status: searchForm.status || undefined,
  };
}

function buildItemQuery() {
  return {
    currentPage: itemPagination.current,
    pageSize: itemPagination.pageSize,
    status: itemSearchForm.status || undefined,
  };
}

async function loadOpsSummary() {
  opsSummaryLoading.value = true;
  try {
    opsSummary.value = await getCrawlerOpsSummary({
      sourceCode: searchForm.sourceId
        ? undefined
        : PUBLIC_OPPORTUNITY_SOURCE_CODE,
      sourceId: searchForm.sourceId,
    });
  } catch (error) {
    console.error('加载运维摘要失败:', error);
    opsSummary.value = null;
  } finally {
    opsSummaryLoading.value = false;
  }
}

async function loadSources() {
  try {
    const result = await getCrawlerSourceList();
    sourceItems.value = result.items;
  } catch (error) {
    console.error('加载采集数据源失败:', error);
    sourceItems.value = [];
  }
}

async function loadTasks() {
  loading.value = true;
  try {
    const result = await getCrawlerTaskList(buildQuery());
    items.value = result.items;
    pagination.total = result.total;
  } catch (error) {
    console.error('加载采集任务失败:', error);
    items.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

function searchTasks() {
  pagination.current = 1;
  filterOpen.value = false;
  void loadTasks();
  void loadOpsSummary();
}

function resetSearch() {
  searchForm.sourceId = undefined;
  searchForm.status = '';
  filterOpen.value = false;
  searchTasks();
}

function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  void loadTasks();
}

async function runDemoTask() {
  if (runningDemo.value) {
    return;
  }
  runningDemo.value = true;
  try {
    const task = await runCrawlerTask();
    message.success(`demo task 已结束：${task.status}`);
    pagination.current = 1;
    await loadTasks();
    await loadOpsSummary();
  } catch (error) {
    console.error('运行 demo task 失败:', error);
    message.error('手动运行 demo task 失败');
  } finally {
    runningDemo.value = false;
  }
}

async function runPublicOpportunityPilot() {
  if (runningPilot.value) {
    return;
  }
  if (!publicOpportunityCanRun.value) {
    message.warning('99cfw 采集未到下次可运行时间，请稍后再试');
    return;
  }
  runningPilot.value = true;
  try {
    const task = await runPublicOpportunityCrawlerTask({
      batchSize: 20,
      freshnessDays: 180,
      sourceCode: selectedPublicSourceCode.value,
    });
    message.success(`99cfw 试点采集已结束：${task.status}`);
    pagination.current = 1;
    await loadTasks();
    await loadOpsSummary();
  } catch (error) {
    console.error('运行 99cfw 试点采集失败:', error);
    message.error('运行 99cfw 试点采集失败');
  } finally {
    runningPilot.value = false;
  }
}

async function refreshCrawlerOps() {
  await loadOpsSummary();
  await loadTasks();
  if (itemOpen.value) {
    await loadTaskItems();
  }
}

async function startAutoScheduler() {
  if (schedulerLoading.value) {
    return;
  }
  schedulerLoading.value = true;
  try {
    await startPublicOpportunityCrawlerScheduler();
    message.success('99cfw 自动调度已启动');
    await loadOpsSummary();
  } catch (error) {
    console.error('启动 99cfw 自动调度失败:', error);
    message.error('启动 99cfw 自动调度失败');
  } finally {
    schedulerLoading.value = false;
  }
}

async function stopAutoScheduler() {
  if (schedulerLoading.value) {
    return;
  }
  schedulerLoading.value = true;
  try {
    await stopPublicOpportunityCrawlerScheduler();
    message.success('99cfw 自动调度已停止');
    await loadOpsSummary();
  } catch (error) {
    console.error('停止 99cfw 自动调度失败:', error);
    message.error('停止 99cfw 自动调度失败');
  } finally {
    schedulerLoading.value = false;
  }
}

async function requeueAllFailedItems() {
  if (requeueLoading.value) {
    return;
  }
  requeueLoading.value = true;
  try {
    const result = await requeueCrawlerTaskItems({
      sourceId: activeOpsSourceId.value,
      statuses: ['FAILED', 'RETRY_WAITING', 'SKIPPED'],
    });
    message.success(`已重新入队 ${result.requeuedCount} 个 URL 项`);
    await refreshCrawlerOps();
  } catch (error) {
    console.error('重新入队失败:', error);
    message.error('重新入队失败');
  } finally {
    requeueLoading.value = false;
  }
}

async function requeueSingleItem(item: CrawlerTaskItem) {
  if (requeueLoading.value) {
    return;
  }
  requeueLoading.value = true;
  try {
    const result = await requeueCrawlerTaskItems({
      itemIds: [item.itemId],
      sourceId: item.sourceId,
    });
    message.success(`已重新入队 ${result.requeuedCount} 个 URL 项`);
    await refreshCrawlerOps();
  } catch (error) {
    console.error('重新入队失败:', error);
    message.error('重新入队失败');
  } finally {
    requeueLoading.value = false;
  }
}

async function reclaimStaleRunningItems() {
  if (reclaimLoading.value) {
    return;
  }
  reclaimLoading.value = true;
  try {
    const result = await reclaimStaleCrawlerTaskItems({
      sourceId: activeOpsSourceId.value,
      staleMinutes: 15,
    });
    message.success(`已回收 ${result.reclaimedCount} 个超时 RUNNING URL 项`);
    await refreshCrawlerOps();
  } catch (error) {
    console.error('回收超时 RUNNING URL 失败:', error);
    message.error('回收超时 RUNNING URL 失败');
  } finally {
    reclaimLoading.value = false;
  }
}

async function openDetail(record: CrawlerTask) {
  detailOpen.value = true;
  detailLoading.value = true;
  currentTask.value = record;
  try {
    currentTask.value = await getCrawlerTaskDetail(record.taskId);
  } catch (error) {
    console.error('加载任务详情失败:', error);
    message.error('采集任务详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

async function openLog(record: CrawlerTask) {
  logOpen.value = true;
  logLoading.value = true;
  currentTask.value = record;
  logItems.value = [];
  try {
    const result = await getCrawlerTaskLogList(record.taskId);
    logItems.value = result.items;
  } catch (error) {
    console.error('加载任务日志失败:', error);
    message.error('采集任务日志加载失败');
  } finally {
    logLoading.value = false;
  }
}

async function loadTaskItems() {
  if (!currentTask.value) {
    return;
  }
  itemLoading.value = true;
  try {
    const result = await getCrawlerTaskItemList(
      currentTask.value.taskId,
      buildItemQuery(),
    );
    taskItemRows.value = result.items;
    itemPagination.total = result.total;
  } catch (error) {
    console.error('加载 URL 采集项失败:', error);
    message.error('URL 采集项加载失败');
  } finally {
    itemLoading.value = false;
  }
}

async function openItems(record: CrawlerTask) {
  itemOpen.value = true;
  currentTask.value = record;
  itemSearchForm.status = '';
  itemPagination.current = 1;
  taskItemRows.value = [];
  await loadTaskItems();
}

function searchItems() {
  itemPagination.current = 1;
  void loadTaskItems();
}

function resetItemSearch() {
  itemSearchForm.status = '';
  searchItems();
}

function onItemPageChange(page: number, pageSize: number) {
  itemPagination.current = page;
  itemPagination.pageSize = pageSize;
  void loadTaskItems();
}

async function cancelTask(record: CrawlerTask) {
  try {
    await cancelCrawlerTask(record.taskId);
    message.success('采集任务已取消');
    await loadTasks();
  } catch (error) {
    console.error('取消采集任务失败:', error);
    message.error('取消采集任务失败');
  }
}

onMounted(() => {
  void loadSources();
  void loadTasks();
  void loadOpsSummary();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <div>
        <h2>采集任务</h2>
        <p>调度、重试、回收和排查 URL 采集任务。</p>
      </div>
      <Button type="primary" :loading="loading" @click="refreshCrawlerOps">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <div class="radar-mobile-overview">
      <div class="overview-item">
        <span>任务总数</span>
        <strong>{{ pagination.total }}</strong>
      </div>
      <div class="overview-item">
        <span>本页运行</span>
        <strong>{{ visibleRunningTaskCount }}</strong>
      </div>
      <div class="overview-item">
        <span>本页失败</span>
        <strong>{{ visibleFailedTaskCount }}</strong>
      </div>
      <div class="overview-item">
        <span>URL 待处理</span>
        <strong>{{ visibleUrlIssueCount }}</strong>
      </div>
    </div>

    <Card v-if="!opsSummaryLoading && opsSummary" class="ops-summary-card">
      <div class="ops-summary-title">99cfw 试点运维摘要</div>
      <div class="ops-summary-kpis">
        <div class="ops-kpi">
          <span>最新任务</span>
          <strong>
            {{
              opsSummary.latestTask
                ? statusMeta[opsSummary.latestTask.status]?.label ||
                  opsSummary.latestTask.status
                : '-'
            }}
          </strong>
        </div>
        <div class="ops-kpi">
          <span>调度</span>
          <strong>
            {{ opsSummary.scheduler.active ? '运行中' : '已停止' }}
          </strong>
        </div>
        <div class="ops-kpi">
          <span>任务失败</span>
          <strong>{{ getStatusCount(opsSummary.taskStatus, 'FAILED') }}</strong>
        </div>
        <div class="ops-kpi">
          <span>URL 失败</span>
          <strong>{{ getStatusCount(opsSummary.itemStatus, 'FAILED') }}</strong>
        </div>
      </div>
      <div class="ops-summary-grid">
        <div class="ops-item ops-item-full">
          <span class="ops-label">数据源</span>
          <span class="ops-value">
            {{
              opsSummary.source
                ? `${opsSummary.source.sourceName} (${opsSummary.source.sourceCode})`
                : '-'
            }}
          </span>
        </div>
        <div class="ops-item">
          <span class="ops-label">状态</span>
          <Tag :color="opsSummary.source?.enabled ? 'green' : 'red'">
            {{ opsSummary.source?.enabled ? '启用' : '停用' }}
          </Tag>
        </div>
        <div class="ops-item">
          <span class="ops-label">上次爬取</span>
          <span class="ops-value">{{
            formatDateOnly(opsSummary.source?.lastCrawledAt)
          }}</span>
        </div>
        <div class="ops-item">
          <span class="ops-label">调度器</span>
          <span class="ops-value">
            <Tag :color="opsSummary.scheduler.active ? 'green' : 'default'">
              {{ opsSummary.scheduler.active ? '运行中' : '已停止' }}
            </Tag>
            <Tag :color="opsSummary.scheduler.running ? 'blue' : 'default'">
              {{ opsSummary.scheduler.running ? '执行中' : '空闲' }}
            </Tag>
            <Tag :color="opsSummary.scheduler.envEnabled ? 'green' : 'default'">
              环境{{ opsSummary.scheduler.envEnabled ? '开' : '关' }}
            </Tag>
            {{ Math.round(opsSummary.scheduler.intervalMs / 1000) }}s
          </span>
        </div>
        <div class="ops-item">
          <span class="ops-label">可运行</span>
          <span class="ops-value">
            <Tag :color="opsSummary.scheduler.canRunNow ? 'green' : 'orange'">
              {{ opsSummary.scheduler.canRunNow ? '是' : '否' }}
            </Tag>
            <span v-if="opsSummary.scheduler.nextRunAt">
              下次 {{ formatDateOnly(opsSummary.scheduler.nextRunAt) }}
            </span>
            <span v-if="opsSummary.scheduler.reason">
              / {{ opsSummary.scheduler.reason }}
            </span>
          </span>
        </div>
        <div class="ops-item">
          <span class="ops-label">最近任务</span>
          <span class="ops-value">
            <template v-if="opsSummary.latestTask">
              <Tag
                :color="
                  statusMeta[opsSummary.latestTask.status]?.color || 'default'
                "
              >
                {{
                  statusMeta[opsSummary.latestTask.status]?.label ||
                  opsSummary.latestTask.status
                }}
              </Tag>
            </template>
            <template v-else>-</template>
          </span>
        </div>
        <div class="ops-item">
          <span class="ops-label">调度周期</span>
          <span class="ops-value">
            开始 {{ formatDateOnly(opsSummary.scheduler.lastTickStartedAt) }} /
            结束 {{ formatDateOnly(opsSummary.scheduler.lastTickFinishedAt) }}
          </span>
        </div>
        <div class="ops-item ops-item-full">
          <span class="ops-label">调度结果</span>
          <span class="ops-value">
            {{ opsSummary.scheduler.lastSkipReason || '无跳过' }} /
            {{ opsSummary.scheduler.lastError || '无错误' }}
          </span>
        </div>
        <div class="ops-item ops-item-full">
          <span class="ops-label">任务状态</span>
          <span class="ops-value">
            <Tag color="green">
              SUCCESS {{ getStatusCount(opsSummary.taskStatus, 'SUCCESS') }}
            </Tag>
            <Tag color="red">
              FAILED {{ getStatusCount(opsSummary.taskStatus, 'FAILED') }}
            </Tag>
            <Tag color="processing">
              RUNNING {{ getStatusCount(opsSummary.taskStatus, 'RUNNING') }}
            </Tag>
          </span>
        </div>
        <div class="ops-item ops-item-full">
          <span class="ops-label">URL 状态</span>
          <span class="ops-value">
            P {{ getStatusCount(opsSummary.itemStatus, 'PENDING') }} / R
            {{ getStatusCount(opsSummary.itemStatus, 'RETRY_WAITING') }} / S
            {{ getStatusCount(opsSummary.itemStatus, 'SUCCESS') }} / F
            {{ getStatusCount(opsSummary.itemStatus, 'FAILED') }} / SKIP
            {{ getStatusCount(opsSummary.itemStatus, 'SKIPPED') }}
          </span>
        </div>
      </div>
      <div
        v-if="opsSummary.latestFailedItems.length > 0"
        class="ops-failed-items"
      >
        <div class="ops-failed-title">最近失败</div>
        <div
          v-for="item in opsSummary.latestFailedItems.slice(0, 3)"
          :key="item.itemId"
          class="ops-failed-item"
        >
          <span class="failed-status">
            <Tag :color="statusMeta[item.status]?.color || 'default'">
              {{ statusMeta[item.status]?.label || item.status }}
            </Tag>
          </span>
          <span class="failed-reason">{{
            item.lastError || item.skipReason || '-'
          }}</span>
          <Button
            size="small"
            type="link"
            :loading="requeueLoading"
            @click="requeueSingleItem(item)"
          >
            重试
          </Button>
          <div class="failed-url">{{ item.sourceUrl }}</div>
        </div>
      </div>
      <div class="ops-actions">
        <Button
          :disabled="opsSummary.scheduler.active"
          :loading="schedulerLoading"
          type="primary"
          @click="startAutoScheduler"
        >
          启动调度
        </Button>
        <Button
          danger
          :disabled="!opsSummary.scheduler.active"
          :loading="schedulerLoading"
          @click="stopAutoScheduler"
        >
          停止调度
        </Button>
        <Button :loading="requeueLoading" @click="requeueAllFailedItems">
          恢复失败/跳过 URL
        </Button>
        <Button :loading="reclaimLoading" @click="reclaimStaleRunningItems">
          回收超时 RUNNING URL
        </Button>
      </div>
    </Card>

    <div v-if="opsSummaryLoading" class="ops-loading">加载中...</div>

    <div class="radar-mobile-filter">
      <div class="mobile-search-bar">
        <Select
          v-model:value="searchForm.status"
          class="mobile-search-input"
          :options="statusOptions"
          @change="searchTasks"
        />
        <Button type="primary" @click="searchTasks">查询</Button>
        <Button @click="filterOpen = !filterOpen">筛选</Button>
      </div>
      <div v-show="filterOpen" class="mobile-filter-panel">
        <Select
          v-model:value="searchForm.sourceId"
          allow-clear
          class="filter-select filter-select-wide"
          :options="sourceOptions"
          @change="searchTasks"
        />
        <div class="filter-actions">
          <Button type="primary" @click="searchTasks">应用筛选</Button>
          <Button @click="resetSearch">重置</Button>
          <Button type="primary" :loading="runningDemo" @click="runDemoTask">
            <PlayCircleOutlined class="mr-1 h-4 w-4" />
            运行 demo
          </Button>
          <Button
            :disabled="!publicOpportunityCanRun"
            :loading="runningPilot"
            type="primary"
            @click="runPublicOpportunityPilot"
          >
            运行试点
          </Button>
        </div>
      </div>
    </div>

    <Spin :spinning="loading">
      <div v-if="items.length > 0" class="radar-mobile-list">
        <Card
          v-for="item in items"
          :key="item.taskId"
          class="radar-mobile-card"
          :body-style="{ padding: '0' }"
        >
          <div class="radar-card-head">
            <div>
              <div class="radar-card-title">
                {{ item.sourceName || item.sourceCode || '采集任务' }}
              </div>
              <div class="radar-card-subtitle">
                {{ formatTaskType(item.taskType) }}
              </div>
            </div>
            <Tag :color="statusMeta[item.status]?.color || 'default'">
              {{ statusMeta[item.status]?.label || item.status }}
            </Tag>
          </div>
          <div class="radar-card-meta">
            <div class="meta-row">
              <span class="meta-label">来源</span>
              <span class="meta-value">{{
                item.sourceName || item.sourceCode || '-'
              }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">抓取数</span>
              <span class="meta-value">{{ item.fetchedCount }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">新增线索</span>
              <span class="meta-value">{{ item.createdLeadCount }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">更新线索</span>
              <span class="meta-value">{{ item.updatedLeadCount }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">跳过</span>
              <span class="meta-value">{{ item.skippedCount }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">URL 统计</span>
              <span class="meta-value">
                P {{ item.pendingItemCount || 0 }} / R
                {{ item.retryWaitingItemCount || 0 }} / S
                {{ item.successItemCount || 0 }} / F
                {{ item.failedItemCount || 0 }}
              </span>
            </div>
            <div v-if="item.errorMessage" class="meta-row error-row">
              <ExclamationCircleOutlined class="error-icon" />
              <span class="error-message">{{ item.errorMessage }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">创建时间</span>
              <span class="meta-value">{{
                formatDateOnly(item.createTime)
              }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">完成时间</span>
              <span class="meta-value">{{
                formatDateOnly(item.finishedAt)
              }}</span>
            </div>
          </div>
          <div class="radar-card-actions">
            <Button
              size="small"
              class="radar-action-btn"
              @click="openDetail(item)"
            >
              <FileTextOutlined class="mr-1 h-4 w-4" />
              详情
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              @click="openLog(item)"
            >
              <ClockCircleOutlined class="mr-1 h-4 w-4" />
              日志
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              @click="openItems(item)"
            >
              <UnorderedListOutlined class="mr-1 h-4 w-4" />
              URL 项
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              :danger="item.status === 'PENDING'"
              type="default"
              :disabled="item.status !== 'PENDING'"
              @click="cancelTask(item)"
            >
              <CloseOutlined class="mr-1 h-4 w-4" />
              取消
            </Button>
          </div>
        </Card>
        <Pagination
          v-if="pagination.total > pagination.pageSize"
          class="radar-mobile-pagination"
          size="small"
          :current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="onPageChange"
        />
      </div>
      <Empty v-else class="radar-mobile-empty" description="暂无采集任务" />
    </Spin>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="采集任务详情"
      placement="right"
      width="100%"
    >
      <div v-if="detailLoading" class="drawer-loading">加载中...</div>
      <div v-else-if="currentTask" class="detail-content">
        <div class="detail-row">
          <span class="detail-label">状态</span>
          <Tag :color="statusMeta[currentTask.status]?.color || 'default'">
            {{ statusMeta[currentTask.status]?.label || currentTask.status }}
          </Tag>
        </div>
        <div class="detail-row">
          <span class="detail-label">任务类型</span>
          <span class="detail-value">{{
            formatTaskType(currentTask.taskType)
          }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">来源</span>
          <span class="detail-value">{{
            currentTask.sourceName || currentTask.sourceCode || '-'
          }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">抓取数</span>
          <span class="detail-value">{{ currentTask.fetchedCount }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">新增线索</span>
          <span class="detail-value">{{ currentTask.createdLeadCount }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">更新线索</span>
          <span class="detail-value">{{ currentTask.updatedLeadCount }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">跳过数</span>
          <span class="detail-value">{{ currentTask.skippedCount }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">URL 统计</span>
          <span class="detail-value">
            PENDING {{ currentTask.pendingItemCount || 0 }} / RETRY_WAITING
            {{ currentTask.retryWaitingItemCount || 0 }} / SUCCESS
            {{ currentTask.successItemCount || 0 }} / FAILED
            {{ currentTask.failedItemCount || 0 }} / SKIPPED
            {{ currentTask.skippedItemCount || 0 }}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">开始时间</span>
          <span class="detail-value">{{
            formatDateOnly(currentTask.startedAt)
          }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">完成时间</span>
          <span class="detail-value">{{
            formatDateOnly(currentTask.finishedAt)
          }}</span>
        </div>
        <div v-if="currentTask.errorMessage" class="detail-row error-row">
          <ExclamationCircleOutlined class="error-icon" />
          <span class="error-message">{{ currentTask.errorMessage }}</span>
        </div>
        <div class="detail-block">
          <span class="detail-label">请求配置</span>
          <pre class="task-json">{{
            formatJsonBlock(currentTask.requestConfigJson)
          }}</pre>
        </div>
      </div>
    </Drawer>

    <Drawer
      v-model:open="logOpen"
      destroy-on-close
      title="采集任务日志"
      placement="right"
      width="100%"
    >
      <Spin :spinning="logLoading">
        <div v-if="logItems.length > 0" class="log-list">
          <div v-for="log in logItems" :key="log.logId" class="log-item">
            <div class="log-header">
              <Tag
                :color="
                  log.level === 'ERROR'
                    ? 'red'
                    : log.level === 'WARN'
                      ? 'orange'
                      : 'default'
                "
              >
                {{ log.level }}
              </Tag>
              <span class="log-stage">{{ log.stage }}</span>
              <span class="log-time">{{ formatDateOnly(log.createTime) }}</span>
            </div>
            <div class="log-message">{{ log.message }}</div>
            <pre v-if="log.detailJson" class="log-detail">{{
              JSON.stringify(log.detailJson, null, 2)
            }}</pre>
          </div>
        </div>
        <Empty v-else description="暂无日志" />
      </Spin>
    </Drawer>

    <Drawer
      v-model:open="itemOpen"
      destroy-on-close
      title="URL 采集项"
      placement="right"
      width="100%"
    >
      <Form layout="horizontal" class="item-filter-form">
        <Form.Item label="状态">
          <Select
            v-model:value="itemSearchForm.status"
            class="filter-select"
            :options="itemStatusOptions"
            @change="searchItems"
          />
        </Form.Item>
        <div class="item-filter-actions">
          <Button type="primary" @click="searchItems">查询</Button>
          <Button @click="resetItemSearch">重置</Button>
          <Button :loading="itemLoading" @click="loadTaskItems">刷新</Button>
        </div>
      </Form>
      <Spin :spinning="itemLoading">
        <div v-if="taskItemRows.length > 0" class="task-item-list">
          <div
            v-for="item in taskItemRows"
            :key="item.itemId"
            class="task-item-card"
          >
            <div class="task-item-header">
              <span class="task-item-id">#{{ item.itemId }}</span>
              <Tag :color="statusMeta[item.status]?.color || 'default'">
                {{ statusMeta[item.status]?.label || item.status }}
              </Tag>
            </div>
            <div class="task-item-url">{{ item.sourceUrl }}</div>
            <div class="task-item-meta">
              <span>重试 {{ item.retryCount }}/{{ item.maxRetryCount }}</span>
              <span v-if="item.lastHttpStatus">
                HTTP {{ item.lastHttpStatus }}
              </span>
            </div>
            <div class="task-item-meta-grid">
              <span>来源 {{ formatSourceRef(item) }}</span>
              <span>发布 {{ formatDateOnly(item.publishedAt) }}</span>
              <span>下次 {{ formatDateOnly(item.nextRetryAt) }}</span>
              <span>开始 {{ formatDateOnly(item.lastStartedAt) }}</span>
              <span>完成 {{ formatDateOnly(item.lastFinishedAt) }}</span>
            </div>
            <div
              v-if="item.lastError || item.skipReason"
              class="task-item-reason"
            >
              {{ item.lastError || item.skipReason }}
            </div>
            <div class="task-item-actions">
              <Button
                size="small"
                :loading="requeueLoading"
                @click="requeueSingleItem(item)"
              >
                重新入队
              </Button>
            </div>
          </div>
          <Pagination
            v-if="itemPagination.total > itemPagination.pageSize"
            class="task-item-pagination"
            size="small"
            :current="itemPagination.current"
            :page-size="itemPagination.pageSize"
            :total="itemPagination.total"
            @change="onItemPageChange"
          />
        </div>
        <Empty v-else description="暂无 URL 采集项" />
      </Spin>
    </Drawer>
  </div>
</template>

<style scoped>
.radar-mobile-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 10px 8px calc(88px + env(safe-area-inset-bottom));
  background: #f0f2f5;
}

.dark .radar-mobile-page {
  background: #1a1a1a;
}

.radar-mobile-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-header {
  background: #2d2d2d;
}

.radar-mobile-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  color: var(--ant-color-text);
}

.radar-mobile-header p {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
}

.radar-mobile-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.overview-item {
  min-width: 0;
  padding: 9px 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .overview-item {
  background: #2d2d2d;
}

.overview-item span {
  display: block;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-item strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  font-size: 17px;
  line-height: 24px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ops-summary-card {
  margin-bottom: 8px;
}

.ops-summary-card :deep(.ant-card-body) {
  padding: 12px;
}

.ops-summary-title {
  margin-bottom: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ant-color-text);
}

.ops-summary-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.ops-kpi {
  min-width: 0;
  padding: 8px;
  background: var(--ant-color-fill-tertiary);
  border-radius: 8px;
}

.ops-kpi span {
  display: block;
  overflow: hidden;
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ops-kpi strong {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  font-size: 15px;
  line-height: 22px;
  color: var(--ant-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ops-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ops-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ops-item-full {
  grid-column: 1 / -1;
}

.ops-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.ops-value {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.ops-value :deep(.ant-tag) {
  margin-bottom: 4px;
  vertical-align: top;
}

.ops-failed-items {
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--ant-color-border);
}

.ops-failed-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ant-color-text);
}

.ops-failed-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 6px;
  margin-bottom: 6px;
  background: var(--ant-color-bg-warning);
  border-radius: 6px;
}

.failed-status {
  flex-shrink: 0;
}

.failed-reason {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.failed-url {
  flex-basis: 100%;
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  line-height: 16px;
  color: var(--ant-color-text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ops-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.ops-actions button {
  width: 100%;
  height: auto;
  min-height: 32px;
  white-space: normal;
}

.ops-actions button :deep(span) {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.ops-loading {
  padding: 16px;
  margin-bottom: 8px;
  text-align: center;
  background: #fff;
  border-radius: 8px;
}

.radar-mobile-filter {
  padding: 12px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-filter {
  background: #2d2d2d;
}

.mobile-search-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 64px;
  gap: 8px;
  align-items: center;
}

.mobile-search-input {
  min-width: 0;
}

.mobile-filter-panel {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid var(--ant-color-border-secondary);
}

.filter-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
}

.filter-select {
  width: 100%;
  min-width: 0;
}

.filter-select-wide {
  width: 100%;
  min-width: 0;
}

.filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-column: 1 / -1;
  gap: 8px;
}

.filter-actions button,
.item-filter-actions button {
  width: 100%;
  height: auto;
  min-height: 32px;
  white-space: normal;
}

.filter-actions button :deep(span),
.item-filter-actions button :deep(span) {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.radar-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card {
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-card {
  background: #2d2d2d;
}

.radar-mobile-card :deep(.ant-card-body) {
  padding: 13px !important;
}

.radar-card-head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
}

.radar-card-head > div:first-child {
  min-width: 0;
}

.radar-card-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.radar-card-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.radar-card-meta {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  gap: 8px;
  min-width: 0;
  margin-bottom: 6px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  flex-shrink: 0;
  min-width: 70px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.meta-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.error-row {
  padding: 8px;
  margin-top: 8px;
  background: var(--ant-color-bg-error);
  border-radius: 6px;
}

.error-icon {
  margin-right: 6px;
  color: var(--ant-color-error);
}

.error-message {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-error);
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
  margin-top: 12px;
  border-top: 1px solid var(--ant-color-border);
}

.radar-action-btn {
  justify-content: center;
  min-width: 0;
  height: auto;
  min-height: 32px;
  white-space: normal;
}

.radar-action-btn :deep(span) {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.radar-mobile-pagination {
  margin-top: 10px;
  text-align: center;
}

.radar-mobile-empty {
  padding: 32px 0;
}

.drawer-loading {
  padding: 16px;
  text-align: center;
}

.detail-content {
  padding: 8px 0;
}

.detail-row {
  display: flex;
  gap: 8px;
  min-width: 0;
  padding: 8px 0;
  border-bottom: 1px solid var(--ant-color-border);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  flex-shrink: 0;
  min-width: 70px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.detail-value {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.detail-block {
  padding: 8px 0;
}

.task-json {
  max-height: 280px;
  padding: 8px;
  margin: 6px 0 0;
  overflow: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--ant-color-fill);
  border-radius: 6px;
}

.log-list {
  max-height: 60vh;
  overflow-y: auto;
}

.log-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--ant-color-border);
}

.log-item:last-child {
  border-bottom: none;
}

.log-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.log-stage {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.log-time {
  margin-left: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.log-message {
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.log-detail {
  padding: 8px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
  white-space: pre-wrap;
  background: var(--ant-color-fill);
  border-radius: 6px;
}

.item-filter-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--ant-color-border);
}

.item-filter-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.task-item-list {
  max-height: 50vh;
  overflow-y: auto;
}

.task-item-card {
  padding: 12px;
  margin-bottom: 8px;
  background: var(--ant-color-bg);
  border-radius: 8px;
}

.task-item-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.task-item-id {
  font-size: 14px;
  font-weight: 600;
  color: var(--ant-color-text);
}

.task-item-url {
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  word-break: break-all;
}

.task-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.task-item-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 8px;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.task-item-meta-grid span {
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.task-item-reason {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-error);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.task-item-actions {
  display: flex;
}

.task-item-pagination {
  margin-top: 10px;
  text-align: center;
}

@media (max-width: 420px) {
  .radar-mobile-overview,
  .ops-summary-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
