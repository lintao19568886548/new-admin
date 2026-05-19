<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  CrawlerOpsSummary,
  CrawlerSource,
  CrawlerTask,
  CrawlerTaskItem,
  CrawlerTaskLog,
  CrawlerTaskStatus,
} from '#/api/investment';

import { computed, h, onMounted, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  message,
  Select,
  Space,
  Table,
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

defineOptions({ name: 'InvestmentRadarCrawlerTasks' });

const PUBLIC_FACTORY_LISTING_SOURCE_CODE = 'PUBLIC_FACTORY_LISTING_CFZSW68';
const PUBLIC_OPPORTUNITY_SOURCE_CODE = 'PUBLIC_OPPORTUNITY_99CFW';

const loading = ref(false);
const runningDemo = ref(false);
const runningPilot = ref(false);
const reclaimLoading = ref(false);
const requeueLoading = ref(false);
const detailLoading = ref(false);
const logLoading = ref(false);
const itemLoading = ref(false);
const detailOpen = ref(false);
const logOpen = ref(false);
const itemOpen = ref(false);
const items = ref<CrawlerTask[]>([]);
const sourceItems = ref<CrawlerSource[]>([]);
const opsSummary = ref<CrawlerOpsSummary | null>(null);
const opsSummaryLoading = ref(false);
const schedulerLoading = ref(false);
const currentTask = ref<CrawlerTask | null>(null);
const logItems = ref<CrawlerTaskLog[]>([]);
const taskItemRows = ref<CrawlerTaskItem[]>([]);
const searchForm = ref({
  sourceId: undefined as number | undefined,
  status: '',
});
const itemSearchForm = ref({
  status: '',
});
const pagination = ref({
  current: 1,
  pageSize: 20,
  showSizeChanger: true,
  total: 0,
});
const itemPagination = ref({
  current: 1,
  pageSize: 20,
  showSizeChanger: true,
  total: 0,
});

const tableLocale = {
  emptyText: '暂无采集任务',
};
const itemTableLocale = {
  emptyText: '暂无 URL 采集项',
};
const statusOptions: Array<{ label: string; value: '' | CrawlerTaskStatus }> = [
  { label: '全部', value: '' },
  { label: '等待中', value: 'PENDING' },
  { label: '运行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILED' },
  { label: '已取消', value: 'CANCELED' },
];
const itemStatusOptions = [
  { label: '全部', value: '' },
  { label: '等待中', value: 'PENDING' },
  { label: '运行中', value: 'RUNNING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '重试等待', value: 'RETRY_WAITING' },
  { label: '失败', value: 'FAILED' },
  { label: '跳过', value: 'SKIPPED' },
];
const statusMeta: Record<string, { color: string; label: string }> = {
  CANCELED: { color: 'default', label: '已取消' },
  FAILED: { color: 'red', label: '失败' },
  PENDING: { color: 'orange', label: '等待中' },
  RETRY_WAITING: { color: 'gold', label: '重试等待' },
  RUNNING: { color: 'processing', label: '运行中' },
  SKIPPED: { color: 'default', label: '跳过' },
  SUCCESS: { color: 'green', label: '成功' },
};
const taskTypeLabel: Record<string, string> = {
  PUBLIC_FACTORY_LISTING_URL_BATCH: '公开厂房URL批量采集',
  PUBLIC_OPPORTUNITY_URL_BATCH: '公开机会URL批量采集',
};
const sourceOptions = computed(() => [
  { label: '全部数据源', value: undefined },
  ...sourceItems.value.map((source) => ({
    label: `${source.sourceName} (${source.sourceCode})`,
    value: source.sourceId,
  })),
]);
const publicOpportunityCanRun = computed(
  () => opsSummary.value?.scheduler.canRunNow !== false,
);

const selectedSource = computed(() =>
  sourceItems.value.find(
    (source) => source.sourceId === searchForm.value.sourceId,
  ),
);

const selectedPublicSourceCode = computed(() => {
  const sourceCode = selectedSource.value?.sourceCode;
  return sourceCode === PUBLIC_FACTORY_LISTING_SOURCE_CODE ||
    sourceCode === PUBLIC_OPPORTUNITY_SOURCE_CODE
    ? sourceCode
    : PUBLIC_OPPORTUNITY_SOURCE_CODE;
});

const activeOpsSourceId = computed(
  () => searchForm.value.sourceId || opsSummary.value?.source?.sourceId,
);

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function getStatusMeta(status: string) {
  return statusMeta[status] || { color: 'default', label: status };
}

function renderStatus(status: string) {
  const meta = getStatusMeta(status);
  return h(Tag, { color: meta.color }, () => meta.label);
}

function getStatusCount(
  source: null | Record<string, number> | undefined,
  status: string,
) {
  return Number(source?.[status] || 0);
}

function buildQuery() {
  return {
    currentPage: pagination.value.current,
    pageSize: pagination.value.pageSize,
    sourceId: searchForm.value.sourceId,
    status: searchForm.value.status || undefined,
  };
}

function buildItemQuery() {
  return {
    currentPage: itemPagination.value.current,
    pageSize: itemPagination.value.pageSize,
    status: itemSearchForm.value.status || undefined,
  };
}

async function loadSources() {
  try {
    const result = await getCrawlerSourceList();
    sourceItems.value = result.items;
  } catch (error) {
    console.error('load crawler sources failed:', error);
  }
}

async function loadOpsSummary() {
  opsSummaryLoading.value = true;
  try {
    opsSummary.value = await getCrawlerOpsSummary({
      sourceCode: searchForm.value.sourceId
        ? undefined
        : PUBLIC_OPPORTUNITY_SOURCE_CODE,
      sourceId: searchForm.value.sourceId,
    });
  } catch (error) {
    console.error('load crawler ops summary failed:', error);
  } finally {
    opsSummaryLoading.value = false;
  }
}

async function startAutoScheduler() {
  if (schedulerLoading.value) {
    return;
  }
  schedulerLoading.value = true;
  try {
    await startPublicOpportunityCrawlerScheduler();
    message.success('99cfw auto scheduler started');
    await loadOpsSummary();
  } catch (error) {
    console.error('start public opportunity crawler scheduler failed:', error);
    message.error('Start 99cfw auto scheduler failed');
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
    message.success('99cfw auto scheduler stopped');
    await loadOpsSummary();
  } catch (error) {
    console.error('stop public opportunity crawler scheduler failed:', error);
    message.error('Stop 99cfw auto scheduler failed');
  } finally {
    schedulerLoading.value = false;
  }
}

async function loadTasks() {
  loading.value = true;
  try {
    const result = await getCrawlerTaskList(buildQuery());
    items.value = result.items;
    pagination.value.total = result.total;
  } catch (error) {
    console.error('load crawler tasks failed:', error);
    message.error('采集任务加载失败');
  } finally {
    loading.value = false;
  }
}

function searchTasks() {
  pagination.value.current = 1;
  void loadTasks();
  void loadOpsSummary();
}

function resetSearch() {
  searchForm.value = {
    sourceId: undefined,
    status: '',
  };
  searchTasks();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  pagination.value.current = page.current || 1;
  pagination.value.pageSize = page.pageSize || 20;
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
    pagination.value.current = 1;
    await loadTasks();
    await loadOpsSummary();
  } catch (error) {
    console.error('run demo crawler task failed:', error);
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
    pagination.value.current = 1;
    await loadTasks();
    await loadOpsSummary();
  } catch (error) {
    console.error('run public opportunity crawler task failed:', error);
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
    console.error('requeue crawler task items failed:', error);
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
    console.error('requeue single crawler task item failed:', error);
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
    console.error('reclaim stale crawler task items failed:', error);
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
    console.error('load crawler task detail failed:', error);
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
    console.error('load crawler task logs failed:', error);
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
    itemPagination.value.total = result.total;
  } catch (error) {
    console.error('load crawler task items failed:', error);
    message.error('URL 采集项加载失败');
  } finally {
    itemLoading.value = false;
  }
}

async function openItems(record: CrawlerTask) {
  itemOpen.value = true;
  currentTask.value = record;
  itemSearchForm.value.status = '';
  itemPagination.value.current = 1;
  taskItemRows.value = [];
  await loadTaskItems();
}

function searchItems() {
  itemPagination.value.current = 1;
  void loadTaskItems();
}

function resetItemSearch() {
  itemSearchForm.value.status = '';
  searchItems();
}

function handleItemTableChange(page: { current?: number; pageSize?: number }) {
  itemPagination.value.current = page.current || 1;
  itemPagination.value.pageSize = page.pageSize || 20;
  void loadTaskItems();
}

async function cancelTask(record: CrawlerTask) {
  try {
    await cancelCrawlerTask(record.taskId);
    message.success('采集任务已取消');
    await loadTasks();
  } catch (error) {
    console.error('cancel crawler task failed:', error);
    message.error('取消采集任务失败');
  }
}

const columns: TableColumnsType<CrawlerTask> = [
  {
    customRender: ({ record }) => record.sourceName || record.sourceCode || '-',
    dataIndex: 'sourceName',
    key: 'sourceName',
    title: '数据源',
    width: 230,
  },
  {
    customRender: ({ record }) =>
      taskTypeLabel[record.taskType] || record.taskType,
    dataIndex: 'taskType',
    key: 'taskType',
    title: '任务类型',
    width: 210,
  },
  {
    customRender: ({ record }) => renderStatus(record.status),
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 120,
  },
  {
    dataIndex: 'fetchedCount',
    key: 'fetchedCount',
    title: '抓取数',
    width: 100,
  },
  {
    dataIndex: 'createdLeadCount',
    key: 'createdLeadCount',
    title: '新增潜客',
    width: 100,
  },
  {
    dataIndex: 'updatedLeadCount',
    key: 'updatedLeadCount',
    title: '更新潜客',
    width: 100,
  },
  {
    dataIndex: 'skippedCount',
    key: 'skippedCount',
    title: '跳过数',
    width: 100,
  },
  {
    customRender: ({ record }) =>
      [
        `待处理 ${record.pendingItemCount || 0}`,
        `重试 ${record.retryWaitingItemCount || 0}`,
        `成功 ${record.successItemCount || 0}`,
        `失败 ${record.failedItemCount || 0}`,
        `跳过 ${record.skippedItemCount || 0}`,
      ].join(' / '),
    key: 'itemStats',
    title: 'URL采集项',
    width: 200,
  },
  {
    customRender: ({ record }) => record.errorMessage || '-',
    dataIndex: 'errorMessage',
    key: 'errorMessage',
    title: '错误信息',
    width: 220,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.createTime),
    dataIndex: 'createTime',
    key: 'createTime',
    title: '创建时间',
    width: 170,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.startedAt),
    dataIndex: 'startedAt',
    key: 'startedAt',
    title: '开始时间',
    width: 170,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.finishedAt),
    dataIndex: 'finishedAt',
    key: 'finishedAt',
    title: '完成时间',
    width: 170,
  },
  {
    customRender: ({ record }) =>
      h(Space, { size: 4 }, () => [
        h(
          Button,
          {
            onClick: () => void openDetail(record),
            size: 'small',
            type: 'link',
          },
          () => '详情',
        ),
        h(
          Button,
          {
            onClick: () => void openLog(record),
            size: 'small',
            type: 'link',
          },
          () => '日志',
        ),
        h(
          Button,
          {
            onClick: () => void openItems(record),
            size: 'small',
            type: 'link',
          },
          () => 'URL项',
        ),
        h(
          Button,
          {
            disabled: record.status !== 'PENDING',
            onClick: () => void cancelTask(record),
            size: 'small',
            type: 'link',
          },
          () => '取消',
        ),
      ]),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 230,
  },
];

const logColumns: TableColumnsType<CrawlerTaskLog> = [
  {
    dataIndex: 'level',
    key: 'level',
    title: 'level',
    width: 90,
  },
  {
    dataIndex: 'stage',
    key: 'stage',
    title: 'stage',
    width: 140,
  },
  {
    dataIndex: 'message',
    key: 'message',
    title: 'message',
    width: 260,
  },
  {
    customRender: ({ record }) =>
      record.detailJson ? JSON.stringify(record.detailJson, null, 2) : '-',
    dataIndex: 'detailJson',
    key: 'detailJson',
    title: 'detailJson',
    width: 360,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.createTime),
    dataIndex: 'createTime',
    key: 'createTime',
    title: 'createTime',
    width: 170,
  },
];

const taskItemColumns: TableColumnsType<CrawlerTaskItem> = [
  {
    dataIndex: 'itemId',
    key: 'itemId',
    title: '采集项ID',
    width: 90,
  },
  {
    customRender: ({ record }) => renderStatus(record.status),
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 130,
  },
  {
    customRender: ({ record }) =>
      `${record.retryCount}/${record.maxRetryCount}`,
    key: 'retry',
    title: '重试次数',
    width: 90,
  },
  {
    dataIndex: 'sourceRefId',
    key: 'sourceRefId',
    title: '来源ID',
    width: 110,
  },
  {
    dataIndex: 'lastHttpStatus',
    key: 'lastHttpStatus',
    title: 'HTTP状态',
    width: 80,
  },
  {
    customRender: ({ record }) => record.skipReason || record.lastError || '-',
    key: 'reason',
    title: '原因',
    width: 260,
  },
  {
    dataIndex: 'sourceUrl',
    key: 'sourceUrl',
    title: 'URL地址',
    width: 420,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.publishedAt),
    dataIndex: 'publishedAt',
    key: 'publishedAt',
    title: '发布时间',
    width: 170,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.nextRetryAt),
    dataIndex: 'nextRetryAt',
    key: 'nextRetryAt',
    title: '下次重试',
    width: 170,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.lastStartedAt),
    dataIndex: 'lastStartedAt',
    key: 'lastStartedAt',
    title: '上次开始',
    width: 170,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.lastFinishedAt),
    dataIndex: 'lastFinishedAt',
    key: 'lastFinishedAt',
    title: '上次完成',
    width: 170,
  },
];

onMounted(() => {
  void loadSources();
  void loadTasks();
  void loadOpsSummary();
});
</script>

<template>
  <div class="crawler-tasks-pane">
    <Alert
      class="mb-3"
      message="采集任务按数据源异步执行。demo 使用本地固定数据；99cfw 试点按 5 分钟后台调度、批量 URL 队列、白名单列表发现和失败重试执行；失败 URL 会进入 RETRY_WAITING/FAILED，不会展示到外部线索或企业信号。"
      show-icon
      type="info"
    />

    <Card class="mb-3" title="99cfw 试点运维摘要">
      <div v-if="opsSummaryLoading" class="py-4 text-center">加载中...</div>
      <Descriptions v-else-if="opsSummary" bordered :column="3" size="small">
        <Descriptions.Item label="source">
          {{
            opsSummary.source
              ? `${opsSummary.source.sourceName} (${opsSummary.source.sourceCode})`
              : '-'
          }}
        </Descriptions.Item>
        <Descriptions.Item label="enabled">
          <Tag :color="opsSummary.source?.enabled ? 'green' : 'red'">
            {{ opsSummary.source?.enabled ? '启用' : '停用' }}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="lastCrawledAt">
          {{ formatOptionalTime(opsSummary.source?.lastCrawledAt) }}
        </Descriptions.Item>
        <Descriptions.Item label="scheduler">
          <Tag :color="opsSummary.scheduler.active ? 'green' : 'default'">
            {{ opsSummary.scheduler.active ? '运行中' : '已停止' }}
          </Tag>
          <Tag :color="opsSummary.scheduler.running ? 'blue' : 'default'">
            {{ opsSummary.scheduler.running ? '执行中' : '空闲' }}
          </Tag>
          <Tag :color="opsSummary.scheduler.envEnabled ? 'green' : 'default'">
            环境 {{ opsSummary.scheduler.envEnabled ? '开启' : '关闭' }}
          </Tag>
          {{ Math.round(opsSummary.scheduler.intervalMs / 1000) }}秒
        </Descriptions.Item>
        <Descriptions.Item label="是否可运行">
          <Tag :color="opsSummary.scheduler.canRunNow ? 'green' : 'orange'">
            {{ opsSummary.scheduler.canRunNow ? '是' : '否' }}
          </Tag>
          <span v-if="opsSummary.scheduler.nextRunAt">
            下次 {{ formatOptionalTime(opsSummary.scheduler.nextRunAt) }}
          </span>
          <span v-if="opsSummary.scheduler.reason">
            / {{ opsSummary.scheduler.reason }}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="最近任务">
          <span v-if="opsSummary.latestTask">
            <Tag :color="getStatusMeta(opsSummary.latestTask.status).color">
              {{ getStatusMeta(opsSummary.latestTask.status).label }}
            </Tag>
          </span>
          <span v-else>-</span>
        </Descriptions.Item>
        <Descriptions.Item label="调度周期">
          开始 {{ formatOptionalTime(opsSummary.scheduler.lastTickStartedAt) }}
          / 结束
          {{ formatOptionalTime(opsSummary.scheduler.lastTickFinishedAt) }}
        </Descriptions.Item>
        <Descriptions.Item label="调度结果" :span="2">
          {{ opsSummary.scheduler.lastSkipReason || '无跳过' }} /
          {{ opsSummary.scheduler.lastError || '无错误' }}
        </Descriptions.Item>
        <Descriptions.Item label="任务状态">
          成功 {{ getStatusCount(opsSummary.taskStatus, 'SUCCESS') }} / 失败
          {{ getStatusCount(opsSummary.taskStatus, 'FAILED') }} / 运行中
          {{ getStatusCount(opsSummary.taskStatus, 'RUNNING') }}
        </Descriptions.Item>
        <Descriptions.Item label="URL采集项状态" :span="2">
          待处理 {{ getStatusCount(opsSummary.itemStatus, 'PENDING') }} / 重试
          {{ getStatusCount(opsSummary.itemStatus, 'RETRY_WAITING') }} / 成功
          {{ getStatusCount(opsSummary.itemStatus, 'SUCCESS') }} / 失败
          {{ getStatusCount(opsSummary.itemStatus, 'FAILED') }} / 跳过
          {{ getStatusCount(opsSummary.itemStatus, 'SKIPPED') }}
        </Descriptions.Item>
        <Descriptions.Item label="最近失败" :span="3">
          <div
            v-if="opsSummary.latestFailedItems.length === 0"
            class="text-text-secondary"
          >
            暂无失败或等待重试 URL
          </div>
          <Space v-else direction="vertical" size="small">
            <span
              v-for="item in opsSummary.latestFailedItems"
              :key="item.itemId"
            >
              #{{ item.itemId }} {{ item.status }} /
              {{ item.lastError || item.skipReason || '-' }} /
              {{ item.sourceUrl }}
              <Button
                size="small"
                type="link"
                :loading="requeueLoading"
                @click="requeueSingleItem(item)"
              >
                重新入队
              </Button>
            </span>
          </Space>
        </Descriptions.Item>
      </Descriptions>
      <Space class="mt-3">
        <Button
          :disabled="!!opsSummary?.scheduler.active"
          :loading="schedulerLoading"
          type="primary"
          @click="startAutoScheduler"
        >
          启动 99cfw 自动调度
        </Button>
        <Button
          :disabled="!opsSummary?.scheduler.active"
          :loading="schedulerLoading"
          @click="stopAutoScheduler"
        >
          停止 99cfw 自动调度
        </Button>
        <Button :loading="requeueLoading" @click="requeueAllFailedItems">
          恢复失败/跳过 URL
        </Button>
        <Button :loading="reclaimLoading" @click="reclaimStaleRunningItems">
          回收超时 RUNNING URL
        </Button>
      </Space>
    </Card>

    <Card class="mb-3" title="筛选">
      <Form class="radar-search-form" layout="inline">
        <Form.Item label="状态">
          <Select
            v-model:value="searchForm.status"
            class="radar-filter-control"
            :options="statusOptions"
          />
        </Form.Item>
        <Form.Item label="数据源">
          <Select
            v-model:value="searchForm.sourceId"
            allow-clear
            class="radar-filter-wide"
            :options="sourceOptions"
          />
        </Form.Item>
        <Form.Item>
          <Space wrap>
            <Button type="primary" @click="searchTasks">查询</Button>
            <Button @click="resetSearch">重置</Button>
            <Button
              :loading="loading || opsSummaryLoading"
              @click="
                () => {
                  void loadTasks();
                  void loadOpsSummary();
                }
              "
            >
              刷新
            </Button>
            <Button type="primary" :loading="runningDemo" @click="runDemoTask">
              手动运行 demo task
            </Button>
            <Button
              :disabled="!publicOpportunityCanRun"
              :loading="runningPilot"
              type="primary"
              @click="runPublicOpportunityPilot"
            >
              运行 99cfw 试点采集
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>

    <Card class="crawler-task-table-card" title="采集任务">
      <Table
        bordered
        :columns="columns"
        :data-source="items"
        :loading="loading"
        :locale="tableLocale"
        :pagination="pagination"
        row-key="taskId"
        :scroll="{ x: 2200 }"
        size="small"
        @change="handleTableChange"
      />
    </Card>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="采集任务详情"
      width="760"
    >
      <div v-if="detailLoading && !currentTask" class="py-8 text-center">
        加载中...
      </div>
      <Descriptions v-else-if="currentTask" bordered :column="2" size="small">
        <Descriptions.Item label="status">
          <Tag :color="getStatusMeta(currentTask.status).color">
            {{ getStatusMeta(currentTask.status).label }}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="source">
          {{ currentTask.sourceName || currentTask.sourceCode || '-' }}
        </Descriptions.Item>
        <Descriptions.Item label="taskType">
          {{ currentTask.taskType }}
        </Descriptions.Item>
        <Descriptions.Item label="fetchedCount">
          {{ currentTask.fetchedCount }}
        </Descriptions.Item>
        <Descriptions.Item label="skippedCount">
          {{ currentTask.skippedCount }}
        </Descriptions.Item>
        <Descriptions.Item label="createdLeadCount">
          {{ currentTask.createdLeadCount }}
        </Descriptions.Item>
        <Descriptions.Item label="updatedLeadCount">
          {{ currentTask.updatedLeadCount }}
        </Descriptions.Item>
        <Descriptions.Item label="URL item stats" :span="2">
          PENDING {{ currentTask.pendingItemCount || 0 }} / RETRY_WAITING
          {{ currentTask.retryWaitingItemCount || 0 }} / SUCCESS
          {{ currentTask.successItemCount || 0 }} / FAILED
          {{ currentTask.failedItemCount || 0 }} / SKIPPED
          {{ currentTask.skippedItemCount || 0 }}
        </Descriptions.Item>
        <Descriptions.Item label="startedAt">
          {{ formatOptionalTime(currentTask.startedAt) }}
        </Descriptions.Item>
        <Descriptions.Item label="finishedAt">
          {{ formatOptionalTime(currentTask.finishedAt) }}
        </Descriptions.Item>
        <Descriptions.Item label="errorMessage" :span="2">
          {{ currentTask.errorMessage || '-' }}
        </Descriptions.Item>
        <Descriptions.Item label="requestConfigJson" :span="2">
          <pre class="task-json">{{
            currentTask.requestConfigJson
              ? JSON.stringify(currentTask.requestConfigJson, null, 2)
              : '-'
          }}</pre>
        </Descriptions.Item>
      </Descriptions>
      <Empty v-else description="暂无详情数据" />
    </Drawer>

    <Drawer
      v-model:open="logOpen"
      destroy-on-close
      title="采集任务日志"
      width="980"
    >
      <Table
        bordered
        :columns="logColumns"
        :data-source="logItems"
        :loading="logLoading"
        :pagination="false"
        row-key="logId"
        :scroll="{ x: 1020 }"
        size="small"
      />
    </Drawer>

    <Drawer
      v-model:open="itemOpen"
      destroy-on-close
      title="URL 采集项"
      width="1180"
    >
      <Form class="radar-search-form mb-3" layout="inline">
        <Form.Item label="status">
          <Select
            v-model:value="itemSearchForm.status"
            class="radar-filter-control"
            :options="itemStatusOptions"
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" @click="searchItems">查询</Button>
            <Button @click="resetItemSearch">重置</Button>
            <Button :loading="itemLoading" @click="loadTaskItems">刷新</Button>
          </Space>
        </Form.Item>
      </Form>
      <Table
        bordered
        :columns="taskItemColumns"
        :data-source="taskItemRows"
        :loading="itemLoading"
        :locale="itemTableLocale"
        :pagination="itemPagination"
        row-key="itemId"
        :scroll="{ x: 2050 }"
        size="small"
        @change="handleItemTableChange"
      />
    </Drawer>
  </div>
</template>

<style lang="less" scoped>
.crawler-tasks-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.crawler-task-table-card {
  flex: none;
}

.task-json {
  margin: 0;
  white-space: pre-wrap;
}

.radar-search-form {
  row-gap: 12px;
}

.radar-filter-control {
  width: 180px;
  min-width: 180px;
}

.radar-filter-wide {
  width: 360px;
  max-width: 100%;
  min-width: 320px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-select-selection-item),
.radar-search-form :deep(.ant-select-selection-placeholder) {
  font-size: 14px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-select-single .ant-select-selector) {
  min-height: 34px;
}

.radar-search-form :deep(.ant-form-item-label > label) {
  color: var(--ant-color-text);
  font-size: 14px;
}

:deep(.ant-table-thead > tr > th) {
  color: var(--ant-color-text);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  vertical-align: middle;
}

:deep(.ant-table-tbody > tr > td) {
  color: var(--ant-color-text);
  font-size: 14px;
  line-height: 22px;
  text-align: center;
  vertical-align: middle;
}
</style>
