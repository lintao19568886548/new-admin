<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  CrawlerSource,
  CrawlerSourceUpdatePayload,
} from '#/api/investment';

import { h, onMounted, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  disableCrawlerSource,
  enableCrawlerSource,
  getCrawlerSourceList,
  runCrawlerTask,
  runPublicOpportunityCrawlerTask,
  updateCrawlerSource,
} from '#/api/investment';

defineOptions({ name: 'InvestmentRadarCrawlerSources' });

const DEMO_SOURCE_CODE = 'DEMO_EXTERNAL_LEAD';
const PUBLIC_FACTORY_LISTING_SOURCE_CODE = 'PUBLIC_FACTORY_LISTING_CFZSW68';
const PUBLIC_OPPORTUNITY_SOURCE_CODE = 'PUBLIC_OPPORTUNITY_99CFW';

const loading = ref(false);
const saving = ref(false);
const runningDemo = ref(false);
const runningPilot = ref(false);
const editOpen = ref(false);
const items = ref<CrawlerSource[]>([]);
const currentSource = ref<CrawlerSource | null>(null);
const lastRunResult = ref<null | {
  createdLeadCount: number;
  fetchedCount: number;
  skippedCount: number;
  status: string;
  taskId: number;
  taskType: string;
  updatedLeadCount: number;
}>(null);
const editForm = ref({
  allowedPathsJson: '',
  blockedPathsJson: '',
  crawlIntervalMinutes: 0,
  enabled: true,
  keywordExcludeJson: '',
  keywordIncludeJson: '',
  rateLimitPerMinute: 1,
  regionScopeJson: '',
  robotsUrl: '',
});

const tableLocale = {
  emptyText: '暂无采集数据源',
};
const jsonPlaceholders = {
  allowedPathsJson: '["/changfangxuqiu/"]',
  blockedPathsJson: '[]',
  keywordExcludeJson: '["住宅","商铺","个人"]',
  keywordIncludeJson: '["扩产","搬迁","租厂房","仓储"]',
  regionScopeJson: '["苏州","上海"]',
};

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function isPublicOpportunitySourceCode(sourceCode?: string) {
  return (
    sourceCode === PUBLIC_OPPORTUNITY_SOURCE_CODE ||
    sourceCode === PUBLIC_FACTORY_LISTING_SOURCE_CODE
  );
}

function formatJsonText(value?: null | string[]) {
  return value && value.length > 0 ? JSON.stringify(value, null, 2) : '';
}

function parseJsonArrayText(value: string, fieldLabel: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  try {
    const parsed = JSON.parse(normalized);
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== 'string')
    ) {
      throw new Error('invalid array');
    }
    return parsed.map((item) => item.trim()).filter(Boolean);
  } catch {
    throw new Error(`${fieldLabel} 必须是字符串数组 JSON`);
  }
}

function syncEditForm(source: CrawlerSource) {
  editForm.value = {
    allowedPathsJson: formatJsonText(source.allowedPathsJson),
    blockedPathsJson: formatJsonText(source.blockedPathsJson),
    crawlIntervalMinutes: source.crawlIntervalMinutes,
    enabled: source.enabled,
    keywordExcludeJson: formatJsonText(source.keywordExcludeJson),
    keywordIncludeJson: formatJsonText(source.keywordIncludeJson),
    rateLimitPerMinute: source.rateLimitPerMinute,
    regionScopeJson: formatJsonText(source.regionScopeJson),
    robotsUrl: source.robotsUrl || '',
  };
}

async function loadSources() {
  loading.value = true;
  try {
    const result = await getCrawlerSourceList();
    items.value = result.items;
  } catch (error) {
    console.error('load crawler sources failed:', error);
    message.error('采集数据源加载失败');
  } finally {
    loading.value = false;
  }
}

function openEdit(source: CrawlerSource) {
  currentSource.value = source;
  syncEditForm(source);
  editOpen.value = true;
}

async function toggleSource(source: CrawlerSource, enabled: boolean) {
  try {
    if (enabled) {
      await enableCrawlerSource(source.sourceId);
      message.success('数据源已启用');
    } else {
      await disableCrawlerSource(source.sourceId);
      message.success('数据源已停用');
    }
    await loadSources();
  } catch (error) {
    console.error('toggle crawler source failed:', error);
    message.error('数据源状态更新失败');
  }
}

async function saveSource() {
  if (!currentSource.value || saving.value) {
    return;
  }

  let payload: CrawlerSourceUpdatePayload;
  try {
    payload = {
      allowedPathsJson: parseJsonArrayText(
        editForm.value.allowedPathsJson,
        '允许路径',
      ),
      blockedPathsJson: parseJsonArrayText(
        editForm.value.blockedPathsJson,
        '屏蔽路径',
      ),
      crawlIntervalMinutes: editForm.value.crawlIntervalMinutes,
      enabled: editForm.value.enabled,
      keywordExcludeJson: parseJsonArrayText(
        editForm.value.keywordExcludeJson,
        '排除关键词',
      ),
      keywordIncludeJson: parseJsonArrayText(
        editForm.value.keywordIncludeJson,
        '包含关键词',
      ),
      rateLimitPerMinute: editForm.value.rateLimitPerMinute,
      regionScopeJson: parseJsonArrayText(
        editForm.value.regionScopeJson,
        '区域范围',
      ),
      robotsUrl: editForm.value.robotsUrl.trim() || null,
    };
  } catch (error) {
    message.error(error instanceof Error ? error.message : '策略格式无效');
    return;
  }

  saving.value = true;
  try {
    await updateCrawlerSource(currentSource.value.sourceId, payload);
    message.success('数据源策略已保存');
    editOpen.value = false;
    await loadSources();
  } catch (error) {
    console.error('save crawler source failed:', error);
    message.error('数据源策略保存失败');
  } finally {
    saving.value = false;
  }
}

function rememberRunResult(task: {
  createdLeadCount: number;
  fetchedCount: number;
  skippedCount: number;
  status: string;
  taskId: number;
  taskType: string;
  updatedLeadCount: number;
}) {
  lastRunResult.value = {
    createdLeadCount: task.createdLeadCount,
    fetchedCount: task.fetchedCount,
    skippedCount: task.skippedCount,
    status: task.status,
    taskId: task.taskId,
    taskType: task.taskType,
    updatedLeadCount: task.updatedLeadCount,
  };
}

async function runDemoTask() {
  if (runningDemo.value) {
    return;
  }
  runningDemo.value = true;
  try {
    const task = await runCrawlerTask();
    rememberRunResult(task);
    message.success(`demo task 已结束：#${task.taskId} / ${task.status}`);
    await loadSources();
  } catch (error) {
    console.error('run demo crawler task failed:', error);
    message.error('手动运行 demo task 失败');
  } finally {
    runningDemo.value = false;
  }
}

async function runPublicOpportunityPilot(
  sourceCode = PUBLIC_OPPORTUNITY_SOURCE_CODE,
) {
  if (runningPilot.value) {
    return;
  }
  runningPilot.value = true;
  try {
    const task = await runPublicOpportunityCrawlerTask({
      batchSize: 20,
      freshnessDays: 180,
      sourceCode,
    });
    rememberRunResult(task);
    message.success(`99cfw 试点采集已结束：#${task.taskId} / ${task.status}`);
    await loadSources();
  } catch (error) {
    console.error('run public opportunity crawler task failed:', error);
    message.error('运行 99cfw 试点采集失败');
  } finally {
    runningPilot.value = false;
  }
}

function renderSourceType(record: CrawlerSource) {
  const color = record.sourceType === 'DEMO' ? 'blue' : 'purple';
  return h(Tag, { color }, () => record.sourceType);
}

const columns: TableColumnsType<CrawlerSource> = [
  {
    dataIndex: 'sourceCode',
    key: 'sourceCode',
    title: 'sourceCode',
    width: 220,
  },
  {
    dataIndex: 'sourceName',
    key: 'sourceName',
    title: 'sourceName',
    width: 220,
  },
  {
    customRender: ({ record }) => renderSourceType(record),
    dataIndex: 'sourceType',
    key: 'sourceType',
    title: 'sourceType',
    width: 150,
  },
  {
    customRender: ({ record }) =>
      h(Tag, { color: record.enabled ? 'green' : 'red' }, () =>
        record.enabled ? '启用' : '停用',
      ),
    dataIndex: 'enabled',
    key: 'enabled',
    title: 'enabled',
    width: 90,
  },
  {
    dataIndex: 'baseUrl',
    key: 'baseUrl',
    title: 'baseUrl',
    width: 220,
  },
  {
    customRender: ({ record }) => record.robotsUrl || '-',
    dataIndex: 'robotsUrl',
    key: 'robotsUrl',
    title: 'robotsUrl',
    width: 240,
  },
  {
    dataIndex: 'crawlIntervalMinutes',
    key: 'crawlIntervalMinutes',
    title: 'crawlIntervalMinutes',
    width: 170,
  },
  {
    dataIndex: 'rateLimitPerMinute',
    key: 'rateLimitPerMinute',
    title: 'rateLimitPerMinute',
    width: 160,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.lastCrawledAt),
    dataIndex: 'lastCrawledAt',
    key: 'lastCrawledAt',
    title: 'lastCrawledAt',
    width: 170,
  },
  {
    customRender: ({ record }) =>
      h(Space, { size: 4 }, () => [
        h(
          Button,
          {
            onClick: () => void toggleSource(record, !record.enabled),
            size: 'small',
            type: 'link',
          },
          () => (record.enabled ? '停用' : '启用'),
        ),
        h(
          Button,
          {
            onClick: () => openEdit(record),
            size: 'small',
            type: 'link',
          },
          () => '编辑策略',
        ),
        h(
          Button,
          {
            disabled: record.sourceCode !== DEMO_SOURCE_CODE,
            loading: runningDemo.value,
            onClick: () => void runDemoTask(),
            size: 'small',
            type: 'link',
          },
          () => '运行 demo',
        ),
        h(
          Button,
          {
            disabled: !isPublicOpportunitySourceCode(record.sourceCode),
            loading: runningPilot.value,
            onClick: () => void runPublicOpportunityPilot(record.sourceCode),
            size: 'small',
            type: 'link',
          },
          () => '运行试点',
        ),
      ]),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 300,
  },
];

onMounted(() => {
  void loadSources();
});
</script>

<template>
  <div class="crawler-sources-pane">
    <Alert
      class="mb-3"
      message="当前支持本地 demo adapter 和公开采集 URL 试点。试点按 180 天时效、批量 20 条、路径白名单和重试队列执行；失败项只保留在任务项和日志里，不进入外部线索或企业信号。"
      show-icon
      type="info"
    />

    <Card class="crawler-source-toolbar">
      <Space wrap>
        <Button :loading="loading" @click="loadSources">刷新</Button>
        <Button type="primary" :loading="runningDemo" @click="runDemoTask">
          手动运行 demo task
        </Button>
        <Button
          :loading="runningPilot"
          type="primary"
          @click="runPublicOpportunityPilot()"
        >
          运行 99cfw 试点采集
        </Button>
        <span v-if="lastRunResult" class="text-text-secondary text-sm">
          最近任务 #{{ lastRunResult.taskId }} / {{ lastRunResult.taskType }}：
          {{ lastRunResult.status }}，抓取 {{ lastRunResult.fetchedCount }}，
          新增 {{ lastRunResult.createdLeadCount }}，更新
          {{ lastRunResult.updatedLeadCount }}，跳过
          {{ lastRunResult.skippedCount }}
        </span>
      </Space>
    </Card>

    <Card class="crawler-source-table-card" title="采集数据源">
      <Table
        :columns="columns"
        :data-source="items"
        :loading="loading"
        :locale="tableLocale"
        :pagination="false"
        row-key="sourceId"
        :scroll="{ x: 1950 }"
        size="small"
      />
    </Card>

    <Drawer
      v-model:open="editOpen"
      destroy-on-close
      title="编辑数据源策略"
      width="720"
    >
      <Form layout="vertical">
        <Form.Item label="enabled">
          <Switch v-model:checked="editForm.enabled" />
        </Form.Item>
        <Form.Item label="crawlIntervalMinutes">
          <InputNumber
            v-model:value="editForm.crawlIntervalMinutes"
            class="w-full"
            :min="0"
          />
        </Form.Item>
        <Form.Item label="rateLimitPerMinute">
          <InputNumber
            v-model:value="editForm.rateLimitPerMinute"
            class="w-full"
            :min="1"
          />
        </Form.Item>
        <Form.Item label="robotsUrl">
          <Input
            v-model:value="editForm.robotsUrl"
            allow-clear
            placeholder="DEMO 可为空；真实/试点 source 需要配置"
          />
        </Form.Item>
        <Form.Item label="allowedPathsJson">
          <Input.TextArea
            v-model:value="editForm.allowedPathsJson"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :placeholder="jsonPlaceholders.allowedPathsJson"
          />
        </Form.Item>
        <Form.Item label="blockedPathsJson">
          <Input.TextArea
            v-model:value="editForm.blockedPathsJson"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :placeholder="jsonPlaceholders.blockedPathsJson"
          />
        </Form.Item>
        <Form.Item label="keywordIncludeJson">
          <Input.TextArea
            v-model:value="editForm.keywordIncludeJson"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :placeholder="jsonPlaceholders.keywordIncludeJson"
          />
        </Form.Item>
        <Form.Item label="keywordExcludeJson">
          <Input.TextArea
            v-model:value="editForm.keywordExcludeJson"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :placeholder="jsonPlaceholders.keywordExcludeJson"
          />
        </Form.Item>
        <Form.Item label="regionScopeJson">
          <Input.TextArea
            v-model:value="editForm.regionScopeJson"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            :placeholder="jsonPlaceholders.regionScopeJson"
          />
        </Form.Item>
      </Form>
      <Space>
        <Button type="primary" :loading="saving" @click="saveSource">
          保存
        </Button>
        <Button @click="editOpen = false">取消</Button>
      </Space>
    </Drawer>
  </div>
</template>

<style lang="less" scoped>
.crawler-sources-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.crawler-source-toolbar {
  margin-bottom: 12px;
  flex: none;
}

.crawler-source-table-card {
  min-height: 0;
  flex: 1;
}
</style>
