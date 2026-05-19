<script lang="ts" setup>
import type {
  SignalEvent,
  SignalEventDetail,
  SignalEventStatus,
  SignalEventType,
  SignalEvidence,
} from '#/api/investment';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  CheckCircleOutlined,
  FileSearchOutlined,
  FileTextOutlined,
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
  Pagination,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  convertSignalEventToRadarLead,
  getSignalEventDetail,
  getSignalEventEvidenceList,
  getSignalEventList,
  rebuildSignalEventDemo,
  updateSignalEvent,
} from '#/api/investment';

import { formatDateOnly } from './mobile-utils';

defineOptions({ name: 'InvestmentRadarMobileSignalEvents' });

const router = useRouter();

const loading = ref(false);
const detailLoading = ref(false);
const evidenceLoading = ref(false);
const rebuilding = ref(false);
const saving = ref(false);
const converting = ref(false);
const detailOpen = ref(false);
const evidenceOpen = ref(false);
const filterOpen = ref(false);
const items = ref<SignalEvent[]>([]);
const currentEvent = ref<null | SignalEventDetail>(null);
const evidenceItems = ref<SignalEvidence[]>([]);
const rebuildSummary = ref<null | {
  createdEventCount: number;
  createdEvidenceCount: number;
  totalSourceLeadCount: number;
  updatedEventCount: number;
  updatedEvidenceCount: number;
}>(null);

const searchForm = reactive({
  companyName: '',
  eventType: '',
  keyword: '',
  sourceName: '',
  sourceType: '',
  status: '',
});

const editForm = reactive<{
  ownerUserId?: number;
  remark?: string;
  status: SignalEventStatus;
}>({
  ownerUserId: undefined,
  remark: undefined,
  status: 'NEW',
});

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const eventTypeOptions: Array<{ label: string; value: '' | SignalEventType }> =
  [
    { label: '全部类型', value: '' },
    { label: '环评扩产', value: 'EIA_EXPAND' },
    { label: '招聘扩张', value: 'RECRUITMENT_EXPAND' },
    { label: '新闻扩张', value: 'NEWS_EXPAND' },
    { label: '租厂需求', value: 'FACTORY_RENT_DEMAND' },
    { label: '公开厂房需求', value: 'PUBLIC_FACTORY_DEMAND' },
    { label: '搬迁', value: 'RELOCATION' },
    { label: '未知', value: 'UNKNOWN' },
  ];

const statusOptions: Array<{ label: string; value: '' | SignalEventStatus }> = [
  { label: '全部状态', value: '' },
  { label: '新信号', value: 'NEW' },
  { label: '已复核', value: 'REVIEWED' },
  { label: '已转潜客', value: 'CONVERTED' },
  { label: '已忽略', value: 'IGNORED' },
];

const sourceTypeOptions = [
  { label: '全部来源类型', value: '' },
  { label: '内部合同', value: 'INTERNAL_CONTRACT' },
  { label: '公开机会', value: 'PUBLIC_OPPORTUNITY' },
  { label: 'Demo', value: 'DEMO' },
];

const editableStatusOptions = statusOptions.filter((item) => item.value);

const eventTypeMeta: Record<SignalEventType, { color: string; label: string }> =
  {
    EIA_EXPAND: { color: 'red', label: '环评扩产' },
    FACTORY_RENT_DEMAND: { color: 'blue', label: '租厂需求' },
    NEWS_EXPAND: { color: 'purple', label: '新闻扩张' },
    PUBLIC_FACTORY_DEMAND: { color: 'cyan', label: '公开厂房需求' },
    RECRUITMENT_EXPAND: { color: 'gold', label: '招聘扩张' },
    RELOCATION: { color: 'orange', label: '搬迁' },
    UNKNOWN: { color: 'default', label: '未知' },
  };

const statusMeta: Record<SignalEventStatus, { color: string; label: string }> =
  {
    CONVERTED: { color: 'green', label: '已转潜客' },
    IGNORED: { color: 'default', label: '已忽略' },
    NEW: { color: 'blue', label: '新信号' },
    REVIEWED: { color: 'orange', label: '已复核' },
  };

const evidenceTypeLabel: Record<string, string> = {
  DEMO_EVIDENCE: '演示证据',
  KEYWORD_MATCH: '关键词匹配',
  STRUCTURED_DATA: '结构化数据',
  TEXT_EVIDENCE: '文本证据',
};

const currentPageConvertedCount = computed(
  () => items.value.filter((item) => item.relatedRadarLeadId).length,
);
const currentPageExternalLeadCount = computed(
  () => items.value.filter((item) => item.relatedExternalLeadId).length,
);
const currentPageNewCount = computed(
  () => items.value.filter((item) => item.status === 'NEW').length,
);
const detailEvidenceCount = computed(() => evidenceItems.value.length);
const pageRangeText = computed(() => {
  if (pagination.total <= 0 || items.value.length === 0) {
    return '0';
  }
  const start = (pagination.current - 1) * pagination.pageSize + 1;
  const end = Math.min(
    pagination.total,
    start + Math.max(items.value.length - 1, 0),
  );
  return `${start}-${end}`;
});
const rebuildSummaryText = computed(() => {
  if (!rebuildSummary.value) {
    return '';
  }
  const totalEvidence =
    rebuildSummary.value.createdEvidenceCount +
    rebuildSummary.value.updatedEvidenceCount;
  return `最近重建：来源 ${rebuildSummary.value.totalSourceLeadCount}，新增 ${rebuildSummary.value.createdEventCount}，更新 ${rebuildSummary.value.updatedEventCount}，证据 ${totalEvidence}`;
});

function buildQuery() {
  return {
    companyName: searchForm.companyName || undefined,
    currentPage: pagination.current,
    eventType: searchForm.eventType || undefined,
    keyword: searchForm.keyword || undefined,
    pageSize: pagination.pageSize,
    sourceName: searchForm.sourceName || undefined,
    sourceType: searchForm.sourceType || undefined,
    status: searchForm.status || undefined,
  };
}

function syncEditForm(event: SignalEventDetail) {
  editForm.ownerUserId = undefined;
  editForm.remark = undefined;
  editForm.status = event.status;
}

function createPreviewDetail(record: SignalEvent): SignalEventDetail {
  return {
    ...record,
    evidences: [],
  };
}

function resetSearchForm() {
  searchForm.companyName = '';
  searchForm.eventType = '';
  searchForm.keyword = '';
  searchForm.sourceName = '';
  searchForm.sourceType = '';
  searchForm.status = '';
}

function renderSource(event: SignalEvent) {
  return event.sourceName || event.sourceType || '-';
}

function renderPaginationTotal(total: number) {
  return `共 ${total} 条`;
}

async function loadEvents() {
  loading.value = true;
  try {
    const result = await getSignalEventList(buildQuery());
    items.value = result.items;
    pagination.total = result.total;
  } catch (error) {
    console.error('加载企业信号失败:', error);
    items.value = [];
    pagination.total = 0;
    message.error('企业信号加载失败');
  } finally {
    loading.value = false;
  }
}

function searchEvents() {
  pagination.current = 1;
  filterOpen.value = false;
  void loadEvents();
}

function resetSearch() {
  resetSearchForm();
  filterOpen.value = false;
  searchEvents();
}

function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  void loadEvents();
}

async function openDetail(record: SignalEvent) {
  detailOpen.value = true;
  detailLoading.value = true;
  const previewDetail = createPreviewDetail(record);
  currentEvent.value = previewDetail;
  evidenceItems.value = [];
  syncEditForm(previewDetail);
  try {
    const detail = await getSignalEventDetail(record.eventId);
    currentEvent.value = detail;
    evidenceItems.value = detail.evidences || [];
    syncEditForm(detail);
  } catch (error) {
    console.error('加载企业信号详情失败:', error);
    message.error('企业信号详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

async function openEvidence(record?: SignalEvent) {
  const target = record || currentEvent.value;
  if (!target) {
    return;
  }

  evidenceOpen.value = true;
  evidenceLoading.value = true;
  try {
    const result = await getSignalEventEvidenceList(target.eventId);
    evidenceItems.value = result.items;
  } catch (error) {
    console.error('加载企业信号证据失败:', error);
    message.error('企业信号证据加载失败');
  } finally {
    evidenceLoading.value = false;
  }
}

async function saveEventStatus() {
  if (!currentEvent.value || saving.value) {
    return;
  }

  saving.value = true;
  try {
    await updateSignalEvent(currentEvent.value.eventId, {
      status: editForm.status,
    });
    message.success('企业信号状态已更新');
    const detail = await getSignalEventDetail(currentEvent.value.eventId);
    currentEvent.value = detail;
    evidenceItems.value = detail.evidences || evidenceItems.value;
    syncEditForm(detail);
    await loadEvents();
  } catch (error) {
    console.error('保存企业信号状态失败:', error);
    message.error('企业信号状态保存失败');
  } finally {
    saving.value = false;
  }
}

async function rebuildDemoSignals() {
  if (rebuilding.value) {
    return;
  }

  rebuilding.value = true;
  try {
    const result = await rebuildSignalEventDemo();
    rebuildSummary.value = result;
    message.success(
      `重建完成：新增 ${result.createdEventCount}，更新 ${result.updatedEventCount}`,
    );
    pagination.current = 1;
    await loadEvents();
  } catch (error) {
    console.error('重建 demo 企业信号失败:', error);
    message.error('重建 demo 企业信号失败');
  } finally {
    rebuilding.value = false;
  }
}

async function convertEvent(record?: SignalEvent) {
  const target = record || currentEvent.value;
  if (!target || converting.value) {
    return;
  }

  converting.value = true;
  try {
    const isCurrentEvent = currentEvent.value?.eventId === target.eventId;
    const ownerUserId = isCurrentEvent ? editForm.ownerUserId || null : null;
    const remark = isCurrentEvent ? editForm.remark?.trim() : undefined;
    const result = await convertSignalEventToRadarLead(target.eventId, {
      ownerUserId,
      remark: remark || '企业信号确认有效，转入雷达潜客',
    });
    message.success(result.reused ? '已复用现有雷达潜客' : '已转为雷达潜客');
    await loadEvents();
    await router.push(`/investment/radar/mobile/${result.radarLeadId}`);
  } catch (error) {
    console.error('企业信号转雷达潜客失败:', error);
    message.error('企业信号转雷达潜客失败');
  } finally {
    converting.value = false;
  }
}

onMounted(() => {
  void loadEvents();
});
</script>

<template>
  <div class="radar-mobile-page">
    <div class="radar-mobile-header">
      <div>
        <h2>企业信号</h2>
        <p>复核公开线索沉淀的扩产、搬迁和租厂信号。</p>
      </div>
      <Button type="primary" :loading="loading" @click="loadEvents">
        <ReloadOutlined class="mr-1 h-4 w-4" />
        刷新
      </Button>
    </div>

    <Alert
      v-if="rebuildSummary"
      class="radar-mobile-alert"
      :message="rebuildSummaryText"
      show-icon
      type="info"
    />

    <div class="radar-mobile-filter">
      <div class="mobile-search-bar">
        <Input
          v-model:value="searchForm.keyword"
          allow-clear
          class="mobile-search-input"
          placeholder="企业 / 标题 / 来源"
          @press-enter="searchEvents"
        />
        <Button type="primary" @click="searchEvents">查询</Button>
        <Button @click="filterOpen = !filterOpen">筛选</Button>
      </div>
      <div v-show="filterOpen" class="mobile-filter-panel">
        <div class="filter-grid">
          <Select
            v-model:value="searchForm.eventType"
            :options="eventTypeOptions"
            @change="searchEvents"
          />
          <Select
            v-model:value="searchForm.status"
            :options="statusOptions"
            @change="searchEvents"
          />
        </div>
        <div class="filter-grid">
          <Input
            v-model:value="searchForm.companyName"
            allow-clear
            placeholder="企业名"
            @press-enter="searchEvents"
          />
          <Input
            v-model:value="searchForm.sourceName"
            allow-clear
            placeholder="来源"
            @press-enter="searchEvents"
          />
        </div>
        <Select
          v-model:value="searchForm.sourceType"
          class="filter-wide"
          :options="sourceTypeOptions"
          @change="searchEvents"
        />
        <div class="filter-actions">
          <Button type="primary" @click="searchEvents">应用筛选</Button>
          <Button @click="resetSearch">重置</Button>
          <Button
            class="filter-action-wide"
            type="primary"
            :loading="rebuilding"
            @click="rebuildDemoSignals"
          >
            <ThunderboltOutlined class="mr-1 h-4 w-4" />
            重建 demo
          </Button>
        </div>
      </div>
    </div>

    <div class="radar-mobile-stats">
      <div class="radar-stat-card">
        <span>总信号</span>
        <strong>{{ pagination.total }}</strong>
      </div>
      <div class="radar-stat-card">
        <span>当前页</span>
        <strong>{{ pageRangeText }}</strong>
      </div>
      <div class="radar-stat-card">
        <span>新信号</span>
        <strong>{{ currentPageNewCount }}</strong>
      </div>
      <div class="radar-stat-card">
        <span>已转化 / 外部线索</span>
        <strong>
          {{ currentPageConvertedCount }} / {{ currentPageExternalLeadCount }}
        </strong>
      </div>
    </div>

    <Spin :spinning="loading">
      <div v-if="items.length > 0" class="radar-mobile-list">
        <Card
          v-for="item in items"
          :key="item.eventId"
          class="radar-mobile-card"
          :body-style="{ padding: '0' }"
        >
          <div class="radar-card-head">
            <div>
              <div class="radar-card-title">{{ item.companyName }}</div>
              <div class="radar-card-subtitle">{{ item.eventTitle }}</div>
            </div>
            <div class="radar-card-tags-row">
              <Tag :color="eventTypeMeta[item.eventType].color">
                {{ eventTypeMeta[item.eventType].label }}
              </Tag>
              <Tag :color="statusMeta[item.status].color">
                {{ statusMeta[item.status].label }}
              </Tag>
            </div>
          </div>

          <div class="radar-card-meta">
            <div class="meta-row">
              <span class="meta-label">置信分</span>
              <span class="meta-value">{{ item.confidenceScore }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">来源</span>
              <span class="meta-value">{{ renderSource(item) }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">事件时间</span>
              <span class="meta-value">{{
                formatDateOnly(item.eventTime)
              }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">外部线索</span>
              <span class="meta-value">{{
                item.relatedExternalLeadId ? '已关联' : '-'
              }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">雷达潜客</span>
              <span class="meta-value">{{
                item.relatedRadarLeadId ? '已转潜客' : '-'
              }}</span>
            </div>
            <div v-if="item.eventSummary" class="meta-row">
              <span class="meta-label">摘要</span>
              <span class="meta-value">{{ item.eventSummary }}</span>
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
              @click="openEvidence(item)"
            >
              <FileSearchOutlined class="mr-1 h-4 w-4" />
              证据
            </Button>
            <Button
              size="small"
              class="radar-action-btn"
              type="primary"
              :disabled="Boolean(item.relatedRadarLeadId)"
              :loading="converting"
              @click="convertEvent(item)"
            >
              <CheckCircleOutlined class="mr-1 h-4 w-4" />
              转潜客
            </Button>
          </div>
        </Card>

        <Pagination
          v-if="pagination.total > pagination.pageSize"
          class="radar-mobile-pagination"
          size="small"
          :current="pagination.current"
          :page-size="pagination.pageSize"
          :show-total="renderPaginationTotal"
          :total="pagination.total"
          @change="onPageChange"
        />
      </div>
      <Empty v-else class="radar-mobile-empty" description="暂无企业信号" />
    </Spin>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="企业信号详情"
      placement="right"
      width="100%"
    >
      <Spin :spinning="detailLoading">
        <template v-if="currentEvent">
          <div class="detail-panel">
            <div class="detail-title">{{ currentEvent.companyName }}</div>
            <div class="detail-subtitle">{{ currentEvent.eventTitle }}</div>
            <div class="detail-tags">
              <Tag :color="eventTypeMeta[currentEvent.eventType].color">
                {{ eventTypeMeta[currentEvent.eventType].label }}
              </Tag>
              <Tag :color="statusMeta[currentEvent.status].color">
                {{ statusMeta[currentEvent.status].label }}
              </Tag>
            </div>
            <div class="detail-row">
              <span>置信分</span>
              <strong>{{ currentEvent.confidenceScore }}</strong>
            </div>
            <div class="detail-row">
              <span>来源</span>
              <strong>{{ renderSource(currentEvent) }}</strong>
            </div>
            <div class="detail-row">
              <span>事件时间</span>
              <strong>{{ formatDateOnly(currentEvent.eventTime) }}</strong>
            </div>
            <div class="detail-row">
              <span>证据数</span>
              <strong>{{ detailEvidenceCount }}</strong>
            </div>
            <div class="detail-row">
              <span>外部线索</span>
              <strong>{{
                currentEvent.relatedExternalLeadId ? '已关联' : '-'
              }}</strong>
            </div>
            <div class="detail-row">
              <span>雷达潜客</span>
              <strong>{{
                currentEvent.relatedRadarLeadId ? '已转潜客' : '未转化'
              }}</strong>
            </div>
            <div class="detail-row">
              <span>创建 / 更新</span>
              <strong>
                {{ formatDateOnly(currentEvent.createTime) }} /
                {{ formatDateOnly(currentEvent.updateTime) }}
              </strong>
            </div>
            <div class="detail-block">
              <span>事件摘要</span>
              <p>{{ currentEvent.eventSummary || '-' }}</p>
            </div>
            <div class="detail-block">
              <span>来源链接</span>
              <a
                :href="currentEvent.sourceUrl"
                target="_blank"
                rel="noreferrer"
              >
                {{ currentEvent.sourceUrl }}
              </a>
            </div>
          </div>

          <Form layout="vertical" class="review-form">
            <Form.Item label="状态">
              <Select
                v-model:value="editForm.status"
                :options="editableStatusOptions"
              />
            </Form.Item>
            <Form.Item label="负责人">
              <InputNumber
                v-model:value="editForm.ownerUserId"
                class="w-full"
                :min="1"
              />
            </Form.Item>
            <Form.Item label="转换备注">
              <Input.TextArea
                v-model:value="editForm.remark"
                :auto-size="{ minRows: 2, maxRows: 4 }"
              />
            </Form.Item>
          </Form>

          <div class="radar-drawer-actions">
            <Button type="primary" :loading="saving" @click="saveEventStatus">
              保存
            </Button>
            <Button @click="openEvidence()">证据</Button>
            <Button
              type="primary"
              :disabled="Boolean(currentEvent.relatedRadarLeadId)"
              :loading="converting"
              @click="convertEvent()"
            >
              转潜客
            </Button>
          </div>
        </template>
        <Empty v-else description="暂无详情数据" />
      </Spin>
    </Drawer>

    <Drawer
      v-model:open="evidenceOpen"
      destroy-on-close
      :title="`企业信号证据（${evidenceItems.length}）`"
      placement="right"
      width="100%"
    >
      <Spin :spinning="evidenceLoading">
        <div v-if="evidenceItems.length > 0" class="evidence-list">
          <Card
            v-for="item in evidenceItems"
            :key="item.evidenceId"
            class="evidence-card"
            :body-style="{ padding: '12px' }"
          >
            <div class="evidence-head">
              <Tag color="blue">
                {{ evidenceTypeLabel[item.evidenceType] || item.evidenceType }}
              </Tag>
              <span>+{{ item.scoreDelta }}</span>
            </div>
            <div class="evidence-title">{{ item.sourceTitle || '-' }}</div>
            <div class="evidence-link">
              <a :href="item.sourceLink" target="_blank" rel="noreferrer">
                {{ item.sourceLink }}
              </a>
            </div>
            <div class="evidence-meta">
              <span>发布 {{ formatDateOnly(item.publishedAt) }}</span>
              <span>采集 {{ formatDateOnly(item.crawledAt) }}</span>
            </div>
            <div
              v-if="item.matchedKeywords.length > 0"
              class="evidence-keywords"
            >
              <Tag v-for="kw in item.matchedKeywords" :key="kw" color="gold">
                {{ kw }}
              </Tag>
            </div>
            <div
              v-if="item.matchedSentences.length > 0"
              class="evidence-sentences"
            >
              <p v-for="sentence in item.matchedSentences" :key="sentence">
                {{ sentence }}
              </p>
            </div>
            <pre class="evidence-text">{{ item.rawText || '-' }}</pre>
          </Card>
        </div>
        <Empty v-else description="暂无证据" />
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

.radar-mobile-header,
.radar-mobile-filter {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.radar-mobile-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
}

.dark .radar-mobile-header,
.dark .radar-mobile-filter {
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

.radar-mobile-alert {
  margin-bottom: 8px;
}

.radar-mobile-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  margin-bottom: 8px;
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
  border-top: 1px solid var(--ant-color-border-secondary);
}

.filter-grid,
.filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.filter-action-wide {
  grid-column: 1 / -1;
}

.filter-wide {
  grid-column: 1 / -1;
}

.radar-mobile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.radar-stat-card {
  min-width: 0;
  padding: 10px 12px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
}

.dark .radar-stat-card {
  background: #2d2d2d;
}

.radar-stat-card span {
  display: block;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.radar-stat-card strong {
  display: block;
  margin-top: 2px;
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
  overflow-wrap: anywhere;
}

.radar-mobile-list,
.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radar-mobile-card,
.evidence-card {
  overflow: hidden;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .radar-mobile-card,
.dark .evidence-card {
  background: #2d2d2d;
}

.radar-mobile-card :deep(.ant-card-body) {
  padding: 13px !important;
}

.radar-card-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.radar-card-head > div:first-child {
  flex: 1 1 180px;
  min-width: 0;
}

.radar-card-title {
  min-width: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 23px;
  color: var(--ant-color-text);
  overflow-wrap: anywhere;
}

.radar-card-subtitle {
  display: -webkit-box;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.radar-card-tags-row,
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
  min-width: 0;
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
  flex-shrink: 0;
  min-width: 72px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
}

.meta-value {
  flex: 1;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
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
}

.radar-action-btn :deep(span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.radar-card-actions > :last-child:nth-child(odd),
.radar-drawer-actions > :last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.radar-mobile-pagination {
  display: flex;
  justify-content: center;
  margin: 6px 0 0;
}

.radar-mobile-empty {
  padding: 32px 0;
}

.drawer-loading {
  padding: 36px 0;
  color: var(--ant-color-text-secondary);
  text-align: center;
}

.detail-panel {
  padding: 12px;
  margin-bottom: 12px;
  background: var(--ant-color-fill-tertiary);
  border-radius: 8px;
}

.detail-title {
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ant-color-text);
}

.detail-subtitle {
  margin-top: 4px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text-secondary);
  overflow-wrap: anywhere;
}

.detail-tags {
  justify-content: flex-start;
  margin-top: 10px;
}

.detail-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 13px;
  line-height: 20px;
}

.detail-row span,
.detail-block span {
  flex-shrink: 0;
  color: var(--ant-color-text-secondary);
}

.detail-row strong {
  min-width: 0;
  font-weight: 500;
  color: var(--ant-color-text);
  text-align: right;
  overflow-wrap: anywhere;
}

.detail-block {
  margin-top: 10px;
}

.detail-block p,
.detail-block a {
  display: block;
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.review-form {
  margin-top: 12px;
}

.radar-drawer-actions {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 12px 0 max(0px, env(safe-area-inset-bottom));
  margin-top: 16px;
  background: var(--ant-color-bg-elevated);
  border-top: 1px solid var(--ant-color-border-secondary);
}

.evidence-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.evidence-head span {
  font-weight: 700;
  color: var(--ant-color-success);
}

.evidence-title {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ant-color-text);
  overflow-wrap: anywhere;
}

.evidence-link {
  margin-top: 4px;
  font-size: 11px;
  line-height: 16px;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.evidence-link a {
  color: var(--ant-color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.evidence-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-tertiary);
}

.evidence-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.evidence-sentences {
  margin-top: 8px;
}

.evidence-sentences p {
  padding: 8px;
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ant-color-text);
  background: var(--ant-color-fill-tertiary);
  border-radius: 6px;
}

.evidence-text {
  max-height: 220px;
  padding: 8px;
  margin: 8px 0 0;
  overflow: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ant-color-text-secondary);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: var(--ant-color-fill-tertiary);
  border-radius: 6px;
}
</style>
