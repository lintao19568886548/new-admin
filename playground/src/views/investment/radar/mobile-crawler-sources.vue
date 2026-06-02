<script lang="ts" setup>
import type {
  CrawlerSource,
  CrawlerSourceUpdatePayload,
} from '#/api/investment';

import { computed, onMounted, ref } from 'vue';

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
  runInternalContractExpiryTask,
  runPublicOpportunityCrawlerTask,
  syncInternalContractExpiryToRadar,
  updateCrawlerSource,
} from '#/api/investment';

import { formatDateOnly } from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileCrawlerSources' });

const INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE = 'INTERNAL_CONTRACT_EXPIRY';
const PUBLIC_FACTORY_LISTING_SOURCE_CODE = 'PUBLIC_FACTORY_LISTING_CFZSW68';
const PUBLIC_OPPORTUNITY_SOURCE_CODE = 'PUBLIC_OPPORTUNITY_99CFW';

const loading = ref(false);
const saving = ref(false);
const runningIncremental = ref(false);
const runningInternalContract = ref(false);
const runningPilot = ref(false);
const syncingInternalContract = ref(false);
const editOpen = ref(false);
const items = ref<CrawlerSource[]>([]);
const currentSource = ref<CrawlerSource | null>(null);
const lastRunResult = ref<null | {
  convertedCount?: number;
  createdLeadCount: number;
  fetchedCount: number;
  reusedCount?: number;
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

const sourceTypeLabel: Record<string, string> = {
  BA_NOTICE: '企业公告',
  BUSINESS_CHANGE: '工商变更',
  EXTERNAL_LEAD: '外部线索',
  INTERNAL_CONTRACT: '内部合同',
  MAP_POLAR: '地图POI',
  PUBLIC_FACTORY_LISTING: '公开厂房',
  PUBLIC_OPPORTUNITY: '公开机会',
  PUBLIC_RECRUITMENT: '招聘信息',
  PUBLIC_TENDER: '招投标',
};

const enabledSourceCount = computed(
  () => items.value.filter((item) => item.enabled).length,
);

const readySourceCount = computed(
  () => items.value.filter((item) => item.adapterStatus === 'READY').length,
);

const candidateSourceCount = computed(
  () => items.value.length - readySourceCount.value,
);

const hasInternalContractSource = computed(() =>
  items.value.some(
    (item) => item.sourceCode === INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE,
  ),
);

const hasPublicOpportunitySource = computed(() =>
  items.value.some((item) => isPublicOpportunitySourceCode(item.sourceCode)),
);

function formatJsonText(value?: null | string[]) {
  return value && value.length > 0 ? JSON.stringify(value, null, 2) : '';
}

function isPublicOpportunitySourceCode(sourceCode?: string) {
  return (
    sourceCode === PUBLIC_OPPORTUNITY_SOURCE_CODE ||
    sourceCode === PUBLIC_FACTORY_LISTING_SOURCE_CODE ||
    sourceCode?.startsWith('PUBLIC_FACTORY_LISTING_') ||
    sourceCode?.startsWith('PUBLIC_DEMAND_')
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

async function runIncrementalTask() {
  if (runningIncremental.value) {
    return;
  }
  runningIncremental.value = true;
  try {
    const task = await runCrawlerTask();
    rememberRunResult(task);
    message.success(`增量采集已结束：${task.status}`);
    await loadSources();
  } catch (error) {
    console.error('运行增量采集失败:', error);
    message.error('手动运行增量采集失败');
  } finally {
    runningIncremental.value = false;
  }
}

async function runInternalContractTask() {
  if (runningInternalContract.value) {
    return;
  }
  runningInternalContract.value = true;
  try {
    const task = await runInternalContractExpiryTask();
    rememberRunResult(task);
    message.success(`内部合同到期任务已结束：${task.status}`);
    await loadSources();
  } catch (error) {
    console.error('运行内部合同到期任务失败:', error);
    message.error('运行内部合同到期任务失败');
  } finally {
    runningInternalContract.value = false;
  }
}

async function syncInternalContractTask() {
  if (syncingInternalContract.value) {
    return;
  }
  syncingInternalContract.value = true;
  try {
    const result = await syncInternalContractExpiryToRadar();
    rememberRunResult(result.task);
    lastRunResult.value = {
      ...lastRunResult.value!,
      convertedCount: result.convertedCount,
      reusedCount: result.reusedCount,
    };
    message.success(
      `内部合同已同步：转雷达 ${result.convertedCount} 条，复用 ${result.reusedCount} 条`,
    );
    await loadSources();
  } catch (error) {
    console.error('同步内部合同到雷达失败:', error);
    message.error('同步内部合同到雷达失败');
  } finally {
    syncingInternalContract.value = false;
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
      batchSize: 10,
      freshnessDays: 180,
      sourceCode,
      staleReprocessMinutes: 5,
    });
    rememberRunResult(task);
    message.success(`99cfw 试点采集已结束：${task.status}`);
    await loadSources();
  } catch (error) {
    console.error('运行 99cfw 试点采集失败:', error);
    message.error('运行 99cfw 试点采集失败');
  } finally {
    runningPilot.value = false;
  }
}

function renderSourceType(source: CrawlerSource) {
  const color =
    source.sourceType === 'INTERNAL_CONTRACT' ? 'geekblue' : 'purple';
  return {
    color,
    label: sourceTypeLabel[source.sourceType] || source.sourceType,
  };
}

function renderAdapterStatus(source: CrawlerSource) {
  return {
    color: source.adapterStatus === 'READY' ? 'green' : 'orange',
    label: source.adapterStatus === 'READY' ? '已接适配器' : '候选源',
  };
}

onMounted(() => {
  void loadSources();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <div>
        <h2>采集数据源</h2>
        <p>维护采集策略、启停数据源并手动运行采集任务。</p>
      </div>
      <Button type="primary" :loading="loading" @click="loadSources">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <div class="radar-mobile-overview">
      <div class="overview-item">
        <span>数据源</span>
        <strong>{{ items.length }}</strong>
      </div>
      <div class="overview-item">
        <span>启用</span>
        <strong>{{ enabledSourceCount }}</strong>
      </div>
      <div class="overview-item">
        <span>已接适配器</span>
        <strong>{{ readySourceCount }}</strong>
      </div>
      <div class="overview-item">
        <span>候选源</span>
        <strong>{{ candidateSourceCount }}</strong>
      </div>
    </div>

    <Alert
      v-if="lastRunResult"
      class="radar-mobile-alert"
      :message="`最近任务 ${lastRunResult.taskType}：${lastRunResult.status}，抓取 ${lastRunResult.fetchedCount}，新增 ${lastRunResult.createdLeadCount}，更新 ${lastRunResult.updatedLeadCount}，跳过 ${lastRunResult.skippedCount}${
        lastRunResult.convertedCount === undefined
          ? ''
          : `，转雷达 ${lastRunResult.convertedCount}，复用 ${lastRunResult.reusedCount || 0}`
      }`"
      show-icon
      type="info"
    />

    <div class="radar-mobile-actions">
      <Button
        type="primary"
        :loading="runningIncremental"
        @click="runIncrementalTask"
      >
        <PlayCircleOutlined class="mr-1 h-4 w-4" />
        增量采集
      </Button>
      <Button
        :disabled="!hasPublicOpportunitySource"
        :loading="runningPilot"
        type="primary"
        @click="runPublicOpportunityPilot()"
      >
        <ThunderboltOutlined class="mr-1 h-4 w-4" />
        运行试点
      </Button>
      <Button
        :disabled="!hasInternalContractSource"
        :loading="runningInternalContract"
        type="primary"
        @click="runInternalContractTask"
      >
        <ThunderboltOutlined class="mr-1 h-4 w-4" />
        运行内部合同
      </Button>
      <Button
        :disabled="!hasInternalContractSource"
        :loading="syncingInternalContract"
        type="primary"
        @click="syncInternalContractTask"
      >
        <ThunderboltOutlined class="mr-1 h-4 w-4" />
        同步雷达
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
              <div class="radar-card-subtitle">
                {{ renderSourceType(item).label }}
              </div>
            </div>
            <div class="radar-card-tags-row">
              <Tag :color="renderSourceType(item).color">
                {{ renderSourceType(item).label }}
              </Tag>
              <Tag :color="renderAdapterStatus(item).color">
                {{ renderAdapterStatus(item).label }}
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
                item.sourceCode === INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE
                  ? 'primary'
                  : 'default'
              "
              :loading="
                runningInternalContract &&
                item.sourceCode === INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE
              "
              :disabled="
                item.sourceCode !== INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE
              "
              @click="runInternalContractTask"
            >
              <ThunderboltOutlined class="mr-1 h-4 w-4" />
              运行内部合同
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              :loading="
                syncingInternalContract &&
                item.sourceCode === INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE
              "
              :disabled="
                item.sourceCode !== INTERNAL_CONTRACT_EXPIRY_SOURCE_CODE
              "
              @click="syncInternalContractTask"
            >
              <ThunderboltOutlined class="mr-1 h-4 w-4" />
              同步雷达
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
              :disabled="
                item.adapterStatus !== 'READY' ||
                !isPublicOpportunitySourceCode(item.sourceCode)
              "
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
      <div v-if="currentSource" class="drawer-summary">
        <div class="drawer-summary-title">{{ currentSource.sourceName }}</div>
        <div class="drawer-summary-subtitle">
          {{ renderSourceType(currentSource).label }}
        </div>
      </div>
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
            placeholder="内置采集源可为空"
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-mobile-actions :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: auto;
  min-height: 32px;
  padding-inline: 8px;
  white-space: normal;
}

.radar-mobile-actions :deep(.ant-btn > span:not(.anticon)) {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.radar-mobile-alert {
  margin-bottom: 8px;
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
  min-width: 0;
  margin-bottom: 6px;
}

.meta-row:last-child {
  margin-bottom: 0;
}

.meta-label {
  flex-shrink: 0;
  min-width: 80px;
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

.meta-value :deep(.ant-tag) {
  max-width: 100%;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: top;
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

.radar-drawer-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}

.radar-drawer-actions button {
  width: 100%;
}

.radar-mobile-empty {
  padding: 32px 0;
}

.drawer-summary {
  padding: 12px;
  margin-bottom: 12px;
  background: var(--ant-color-fill-tertiary);
  border-radius: 8px;
}

.drawer-summary-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.drawer-summary-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  word-break: break-word;
  overflow-wrap: anywhere;
}

@media (max-width: 420px) {
  .radar-mobile-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
