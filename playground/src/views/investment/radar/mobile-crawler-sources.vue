<script lang="ts" setup>
import type {
  CrawlerSource,
  CrawlerSourceUpdatePayload,
} from '#/api/investment';

import { onMounted, ref } from 'vue';

import {
  EditOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Spin,
  Switch,
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

import { formatDateOnly } from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileCrawlerSources' });

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

const jsonPlaceholders = {
  allowedPathsJson: '["/changfangxuqiu/"]',
  blockedPathsJson: '[]',
  keywordExcludeJson: '["住宅","商铺","个人"]',
  keywordIncludeJson: '["扩产","搬迁","租厂房","仓储"]',
  regionScopeJson: '["苏州","上海"]',
};

function formatJsonText(value?: null | string[]) {
  return value && value.length > 0 ? JSON.stringify(value, null, 2) : '';
}

function isPublicOpportunitySourceCode(sourceCode?: string) {
  return (
    sourceCode === PUBLIC_OPPORTUNITY_SOURCE_CODE ||
    sourceCode === PUBLIC_FACTORY_LISTING_SOURCE_CODE
  );
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
    console.error('加载采集数据源失败:', error);
    items.value = [];
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
    console.error('更新数据源状态失败:', error);
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
    console.error('保存数据源策略失败:', error);
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
    console.error('运行 demo task 失败:', error);
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
    console.error('运行 99cfw 试点采集失败:', error);
    message.error('运行 99cfw 试点采集失败');
  } finally {
    runningPilot.value = false;
  }
}

function renderSourceType(source: CrawlerSource) {
  const color = source.sourceType === 'DEMO' ? 'blue' : 'purple';
  return { color, label: source.sourceType };
}

onMounted(() => {
  void loadSources();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <Button type="primary" :loading="loading" @click="loadSources">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <Alert
      v-if="lastRunResult"
      message="最近任务 #{{ lastRunResult.taskId }} / {{ lastRunResult.taskType }}：{{ lastRunResult.status }}，抓取 {{ lastRunResult.fetchedCount }}，新增 {{ lastRunResult.createdLeadCount }}，更新 {{ lastRunResult.updatedLeadCount }}，跳过 {{ lastRunResult.skippedCount }}"
      show-icon
      type="info"
    />

    <div class="radar-mobile-actions">
      <Button type="primary" :loading="runningDemo" @click="runDemoTask">
        <PlayCircleOutlined class="mr-1 h-4 w-4" />
        运行 demo
      </Button>
      <Button
        :loading="runningPilot"
        type="primary"
        @click="runPublicOpportunityPilot()"
      >
        <ThunderboltOutlined class="mr-1 h-4 w-4" />
        运行试点
      </Button>
    </div>

    <Spin :spinning="loading">
      <div v-if="items.length > 0" class="radar-mobile-list">
        <Card
          v-for="item in items"
          :key="item.sourceId"
          class="radar-mobile-card"
          :body-style="{ padding: '0' }"
        >
          <div class="radar-card-head">
            <div>
              <div class="radar-card-title">{{ item.sourceName }}</div>
              <div class="radar-card-subtitle">{{ item.sourceCode }}</div>
            </div>
            <div class="radar-card-tags-row">
              <Tag :color="renderSourceType(item).color">
                {{ renderSourceType(item).label }}
              </Tag>
              <Tag :color="item.enabled ? 'green' : 'red'">
                {{ item.enabled ? '启用' : '停用' }}
              </Tag>
            </div>
          </div>
          <div class="radar-card-meta">
            <div class="meta-row">
              <span class="meta-label">基础 URL</span>
              <span class="meta-value">{{ item.baseUrl || '-' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">爬取间隔</span>
              <span class="meta-value">
                {{ item.crawlIntervalMinutes }} 分钟
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">限流</span>
              <span class="meta-value">
                {{ item.rateLimitPerMinute }} 次/分
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">robots</span>
              <span class="meta-value">{{ item.robotsUrl || '-' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">上次爬取</span>
              <span class="meta-value">{{
                formatDateOnly(item.lastCrawledAt)
              }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">包含关键词</span>
              <span class="meta-value">
                <Tag
                  v-for="kw in (item.keywordIncludeJson || []).slice(0, 3)"
                  :key="kw"
                  color="green"
                >
                  {{ kw }}
                </Tag>
                <span
                  v-if="(item.keywordIncludeJson || []).length > 3"
                  class="text-text-secondary"
                >
                  +{{ (item.keywordIncludeJson || []).length - 3 }}
                </span>
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">排除关键词</span>
              <span class="meta-value">
                <Tag
                  v-for="kw in (item.keywordExcludeJson || []).slice(0, 3)"
                  :key="kw"
                  color="orange"
                >
                  {{ kw }}
                </Tag>
                <span
                  v-if="(item.keywordExcludeJson || []).length > 3"
                  class="text-text-secondary"
                >
                  +{{ (item.keywordExcludeJson || []).length - 3 }}
                </span>
              </span>
            </div>
          </div>
          <div class="radar-card-actions">
            <Button
              size="small"
              class="radar-action-btn"
              @click="openEdit(item)"
            >
              <EditOutlined class="mr-1 h-4 w-4" />
              编辑策略
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              :danger="item.enabled"
              :type="item.enabled ? 'default' : 'primary'"
              @click="toggleSource(item, !item.enabled)"
            >
              <PoweroffOutlined class="mr-1 h-4 w-4" />
              {{ item.enabled ? '停用' : '启用' }}
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              :type="
                item.sourceCode === DEMO_SOURCE_CODE ? 'primary' : 'default'
              "
              :loading="runningDemo && item.sourceCode === DEMO_SOURCE_CODE"
              :disabled="item.sourceCode !== DEMO_SOURCE_CODE"
              @click="runDemoTask"
            >
              <PlayCircleOutlined class="mr-1 h-4 w-4" />
              运行 demo
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              :type="
                isPublicOpportunitySourceCode(item.sourceCode)
                  ? 'primary'
                  : 'default'
              "
              :loading="
                runningPilot && isPublicOpportunitySourceCode(item.sourceCode)
              "
              :disabled="!isPublicOpportunitySourceCode(item.sourceCode)"
              @click="runPublicOpportunityPilot(item.sourceCode)"
            >
              <ThunderboltOutlined class="mr-1 h-4 w-4" />
              运行试点
            </Button>
          </div>
        </Card>
      </div>
      <Empty v-else class="radar-mobile-empty" description="暂无采集数据源" />
    </Spin>

    <Drawer
      v-model:open="editOpen"
      destroy-on-close
      title="编辑数据源策略"
      placement="right"
      width="100%"
    >
      <Form layout="vertical">
        <Form.Item label="启用状态">
          <Switch v-model:checked="editForm.enabled" />
        </Form.Item>
        <Form.Item label="爬取间隔(分钟)">
          <InputNumber
            v-model:value="editForm.crawlIntervalMinutes"
            class="w-full"
            :min="0"
          />
        </Form.Item>
        <Form.Item label="限流(次/分)">
          <InputNumber
            v-model:value="editForm.rateLimitPerMinute"
            class="w-full"
            :min="1"
          />
        </Form.Item>
        <Form.Item label="robots URL">
          <Input
            v-model:value="editForm.robotsUrl"
            allow-clear
            placeholder="DEMO 可为空"
          />
        </Form.Item>
        <Form.Item label="允许路径">
          <Input.TextArea
            v-model:value="editForm.allowedPathsJson"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            :placeholder="jsonPlaceholders.allowedPathsJson"
          />
        </Form.Item>
        <Form.Item label="屏蔽路径">
          <Input.TextArea
            v-model:value="editForm.blockedPathsJson"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            :placeholder="jsonPlaceholders.blockedPathsJson"
          />
        </Form.Item>
        <Form.Item label="包含关键词">
          <Input.TextArea
            v-model:value="editForm.keywordIncludeJson"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            :placeholder="jsonPlaceholders.keywordIncludeJson"
          />
        </Form.Item>
        <Form.Item label="排除关键词">
          <Input.TextArea
            v-model:value="editForm.keywordExcludeJson"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            :placeholder="jsonPlaceholders.keywordExcludeJson"
          />
        </Form.Item>
        <Form.Item label="区域范围">
          <Input.TextArea
            v-model:value="editForm.regionScopeJson"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            :placeholder="jsonPlaceholders.regionScopeJson"
          />
        </Form.Item>
      </Form>
      <div class="radar-drawer-actions">
        <Button type="primary" :loading="saving" @click="saveSource">
          保存
        </Button>
        <Button @click="editOpen = false">取消</Button>
      </div>
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

.radar-mobile-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-actions Button {
  flex: 1;
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
  overflow-wrap: anywhere;
  word-break: break-word;
}

.radar-card-subtitle {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  margin-top: 2px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.radar-card-tags-row {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  max-width: 46%;
}

.radar-card-meta {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  min-width: 80px;
  flex-shrink: 0;
}

.meta-value {
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  flex: 1;
  word-break: break-word;
}

.radar-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--ant-color-border);
}

.radar-action-btn {
  justify-content: center;
}

.radar-drawer-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.radar-drawer-actions Button {
  flex: 1;
}

.radar-mobile-empty {
  padding: 32px 0;
}
</style>
