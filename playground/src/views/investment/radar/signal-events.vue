<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  SignalEvent,
  SignalEventDetail,
  SignalEventStatus,
  SignalEventType,
  SignalEvidence,
} from '#/api/investment';

import { computed, h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Table,
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

defineOptions({ name: 'InvestmentRadarSignalEvents' });

const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const evidenceLoading = ref(false);
const rebuilding = ref(false);
const saving = ref(false);
const converting = ref(false);
const detailOpen = ref(false);
const evidenceOpen = ref(false);
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
const pagination = ref({
  current: 1,
  pageSize: 20,
  showSizeChanger: true,
  total: 0,
});
const searchForm = ref({
  companyName: '',
  eventType: '',
  keyword: '',
  sourceName: '',
  sourceType: '',
  status: '',
});
const editForm = ref<{
  ownerUserId?: number;
  remark?: string;
  status: SignalEventStatus;
}>({
  ownerUserId: undefined,
  remark: undefined,
  status: 'NEW',
});

const eventTypeOptions: Array<{ label: string; value: '' | SignalEventType }> =
  [
    { label: '全部', value: '' },
    { label: '环评扩产', value: 'EIA_EXPAND' },
    { label: '招聘扩张', value: 'RECRUITMENT_EXPAND' },
    { label: '新闻扩张', value: 'NEWS_EXPAND' },
    { label: '租厂需求', value: 'FACTORY_RENT_DEMAND' },
    { label: '公开厂房需求', value: 'PUBLIC_FACTORY_DEMAND' },
    { label: '搬迁', value: 'RELOCATION' },
    { label: '未知', value: 'UNKNOWN' },
  ];
const statusOptions: Array<{ label: string; value: '' | SignalEventStatus }> = [
  { label: '全部', value: '' },
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
const tableLocale = {
  emptyText: '暂无企业信号',
};
const detailEvidenceCount = computed(() => evidenceItems.value.length);

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function renderEventType(eventType: SignalEventType) {
  const meta = eventTypeMeta[eventType] || {
    color: 'default',
    label: eventType,
  };
  return h(Tag, { color: meta.color }, () => meta.label);
}

function renderStatus(status: SignalEventStatus) {
  const meta = statusMeta[status] || { color: 'default', label: status };
  return h(Tag, { color: meta.color }, () => meta.label);
}

function buildQuery() {
  return {
    companyName: searchForm.value.companyName || undefined,
    currentPage: pagination.value.current,
    eventType: searchForm.value.eventType || undefined,
    keyword: searchForm.value.keyword || undefined,
    pageSize: pagination.value.pageSize,
    sourceName: searchForm.value.sourceName || undefined,
    sourceType: searchForm.value.sourceType || undefined,
    status: searchForm.value.status || undefined,
  };
}

async function loadEvents() {
  loading.value = true;
  try {
    const result = await getSignalEventList(buildQuery());
    items.value = result.items;
    pagination.value.total = result.total;
  } catch (error) {
    console.error('load signal events failed:', error);
    message.error('企业信号加载失败');
  } finally {
    loading.value = false;
  }
}

function searchEvents() {
  pagination.value.current = 1;
  void loadEvents();
}

function resetSearch() {
  searchForm.value = {
    companyName: '',
    eventType: '',
    keyword: '',
    sourceName: '',
    sourceType: '',
    status: '',
  };
  searchEvents();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  pagination.value.current = page.current || 1;
  pagination.value.pageSize = page.pageSize || 20;
  void loadEvents();
}

function syncEditForm(event: SignalEventDetail) {
  editForm.value = {
    ownerUserId: undefined,
    remark: undefined,
    status: event.status,
  };
}

async function openDetail(record: SignalEvent) {
  detailOpen.value = true;
  detailLoading.value = true;
  currentEvent.value = null;
  evidenceItems.value = [];
  try {
    const detail = await getSignalEventDetail(record.eventId);
    currentEvent.value = detail;
    evidenceItems.value = detail.evidences || [];
    syncEditForm(detail);
  } catch (error) {
    console.error('load signal event detail failed:', error);
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
    console.error('load signal evidence failed:', error);
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
      status: editForm.value.status,
    });
    message.success('企业信号状态已更新');
    const detail = await getSignalEventDetail(currentEvent.value.eventId);
    currentEvent.value = detail;
    syncEditForm(detail);
    await loadEvents();
  } catch (error) {
    console.error('save signal event failed:', error);
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
    pagination.value.current = 1;
    await loadEvents();
  } catch (error) {
    console.error('rebuild signal events failed:', error);
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
    const result = await convertSignalEventToRadarLead(target.eventId, {
      ownerUserId: editForm.value.ownerUserId || null,
      remark: editForm.value.remark || '企业信号确认有效，转入雷达潜客',
    });
    message.success(result.reused ? '已复用现有雷达潜客' : '已转为雷达潜客');
    await loadEvents();
    router.push(`/investment/radar/${result.radarLeadId}`);
  } catch (error) {
    console.error('convert signal event failed:', error);
    message.error('企业信号转雷达潜客失败');
  } finally {
    converting.value = false;
  }
}

const columns: TableColumnsType<SignalEvent> = [
  {
    customRender: ({ record }) =>
      h('div', { class: 'signal-title-cell' }, [
        h('div', { class: 'font-medium' }, record.companyName),
        h('div', { class: 'text-xs text-gray-500' }, record.eventTitle),
      ]),
    dataIndex: 'companyName',
    key: 'companyName',
    title: '企业 / 信号',
    width: 280,
  },
  {
    customRender: ({ record }) => renderEventType(record.eventType),
    dataIndex: 'eventType',
    key: 'eventType',
    title: '事件类型',
    width: 120,
  },
  {
    customRender: ({ record }) => renderStatus(record.status),
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 110,
  },
  {
    dataIndex: 'confidenceScore',
    key: 'confidenceScore',
    title: '置信度',
    width: 90,
  },
  {
    customRender: ({ record }) =>
      h('div', { class: 'signal-source-cell' }, [
        h('div', record.sourceName || record.sourceType || '-'),
        h('div', { class: 'text-xs text-gray-500' }, record.sourceUrl),
      ]),
    dataIndex: 'sourceName',
    key: 'sourceName',
    title: '来源',
    width: 260,
  },
  {
    customRender: ({ record }) =>
      record.relatedExternalLeadId ? `#${record.relatedExternalLeadId}` : '-',
    dataIndex: 'relatedExternalLeadId',
    key: 'relatedExternalLeadId',
    title: '外部线索',
    width: 110,
  },
  {
    customRender: ({ record }) =>
      record.relatedRadarLeadId ? `#${record.relatedRadarLeadId}` : '-',
    dataIndex: 'relatedRadarLeadId',
    key: 'relatedRadarLeadId',
    title: '雷达潜客',
    width: 110,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.eventTime),
    dataIndex: 'eventTime',
    key: 'eventTime',
    title: '事件时间',
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
            onClick: () => void openEvidence(record),
            size: 'small',
            type: 'link',
          },
          () => '证据',
        ),
        h(
          Button,
          {
            disabled: Boolean(record.relatedRadarLeadId),
            loading: converting.value,
            onClick: () => void convertEvent(record),
            size: 'small',
            type: 'link',
          },
          () => '转潜客',
        ),
      ]),
    fixed: 'right',
    key: 'operation',
    title: '操作',
    width: 180,
  },
];

const evidenceColumns: TableColumnsType<SignalEvidence> = [
  {
    dataIndex: 'evidenceType',
    key: 'evidenceType',
    title: '类型',
    width: 110,
  },
  {
    dataIndex: 'sourceTitle',
    key: 'sourceTitle',
    title: '来源标题',
    width: 220,
  },
  {
    customRender: ({ record }) => record.matchedKeywords.join(', ') || '-',
    key: 'matchedKeywords',
    title: '命中词',
    width: 180,
  },
  {
    customRender: ({ record }) => record.matchedSentences.join('\n') || '-',
    key: 'matchedSentences',
    title: '命中句',
    width: 280,
  },
  {
    dataIndex: 'scoreDelta',
    key: 'scoreDelta',
    title: '加分',
    width: 80,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.publishedAt),
    key: 'publishedAt',
    title: '发布时间',
    width: 170,
  },
];

onMounted(() => {
  void loadEvents();
});
</script>

<template>
  <div class="signal-events-pane">
    <Alert
      class="mb-3"
      message="企业信号由外部公开线索和证据链重建生成，是后续企业画像和评分引擎的统一输入。"
      show-icon
      type="info"
    />

    <Card class="mb-3" title="筛选">
      <Form class="radar-search-form" layout="inline">
        <Form.Item label="关键词">
          <Input
            v-model:value="searchForm.keyword"
            allow-clear
            class="radar-filter-keyword"
            placeholder="企业 / 标题 / 来源"
            @press-enter="searchEvents"
          />
        </Form.Item>
        <Form.Item label="企业名">
          <Input
            v-model:value="searchForm.companyName"
            allow-clear
            class="radar-filter-control"
            @press-enter="searchEvents"
          />
        </Form.Item>
        <Form.Item label="事件类型">
          <Select
            v-model:value="searchForm.eventType"
            class="radar-filter-control"
            :options="eventTypeOptions"
          />
        </Form.Item>
        <Form.Item label="状态">
          <Select
            v-model:value="searchForm.status"
            class="radar-filter-control"
            :options="statusOptions"
          />
        </Form.Item>
        <Form.Item label="来源">
          <Input
            v-model:value="searchForm.sourceName"
            allow-clear
            class="radar-filter-control"
            @press-enter="searchEvents"
          />
        </Form.Item>
        <Form.Item label="来源类型">
          <Select
            v-model:value="searchForm.sourceType"
            class="radar-filter-control"
            :options="sourceTypeOptions"
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" @click="searchEvents">查询</Button>
            <Button @click="resetSearch">重置</Button>
            <Button :loading="loading" @click="loadEvents">刷新</Button>
            <Button
              type="primary"
              :loading="rebuilding"
              @click="rebuildDemoSignals"
            >
              重建 demo 信号
            </Button>
          </Space>
        </Form.Item>
      </Form>
      <div v-if="rebuildSummary" class="text-text-secondary mt-3 text-sm">
        最近重建：来源线索 {{ rebuildSummary.totalSourceLeadCount }}，新增事件
        {{ rebuildSummary.createdEventCount }}，更新事件
        {{ rebuildSummary.updatedEventCount }}，新增证据
        {{ rebuildSummary.createdEvidenceCount }}，更新证据
        {{ rebuildSummary.updatedEvidenceCount }}
      </div>
    </Card>

    <Card class="signal-table-card" title="企业信号事件">
      <Table
        :columns="columns"
        :data-source="items"
        :loading="loading"
        :locale="tableLocale"
        :pagination="pagination"
        row-key="eventId"
        :scroll="{ x: 1440 }"
        size="small"
        @change="handleTableChange"
      />
    </Card>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="企业信号详情"
      width="860"
    >
      <div v-if="detailLoading" class="py-8 text-center">加载中...</div>
      <template v-else-if="currentEvent">
        <Descriptions
          bordered
          :column="2"
          class="signal-event-detail"
          size="small"
        >
          <Descriptions.Item label="企业">
            {{ currentEvent.companyName }}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <component :is="renderStatus(currentEvent.status)" />
          </Descriptions.Item>
          <Descriptions.Item label="事件类型">
            <component :is="renderEventType(currentEvent.eventType)" />
          </Descriptions.Item>
          <Descriptions.Item label="置信度">
            {{ currentEvent.confidenceScore }}
          </Descriptions.Item>
          <Descriptions.Item label="事件标题" :span="2">
            {{ currentEvent.eventTitle }}
          </Descriptions.Item>
          <Descriptions.Item label="事件摘要" :span="2">
            {{ currentEvent.eventSummary || '-' }}
          </Descriptions.Item>
          <Descriptions.Item label="来源" :span="2">
            {{ currentEvent.sourceName }} / {{ currentEvent.sourceUrl }}
          </Descriptions.Item>
          <Descriptions.Item label="关联外部线索">
            {{
              currentEvent.relatedExternalLeadId
                ? `#${currentEvent.relatedExternalLeadId}`
                : '-'
            }}
          </Descriptions.Item>
          <Descriptions.Item label="关联雷达潜客">
            {{
              currentEvent.relatedRadarLeadId
                ? `#${currentEvent.relatedRadarLeadId}`
                : '-'
            }}
          </Descriptions.Item>
          <Descriptions.Item label="证据数">
            {{ detailEvidenceCount }}
          </Descriptions.Item>
          <Descriptions.Item label="事件时间">
            {{ formatOptionalTime(currentEvent.eventTime) }}
          </Descriptions.Item>
        </Descriptions>

        <Card class="mt-4" title="人工复核">
          <Form layout="vertical">
            <Form.Item label="状态">
              <Select
                v-model:value="editForm.status"
                :options="statusOptions.filter((item) => item.value)"
              />
            </Form.Item>
            <Form.Item label="负责人用户 ID">
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
          <Space>
            <Button type="primary" :loading="saving" @click="saveEventStatus">
              保存状态
            </Button>
            <Button @click="openEvidence()">查看证据</Button>
            <Button
              type="primary"
              :disabled="Boolean(currentEvent.relatedRadarLeadId)"
              :loading="converting"
              @click="convertEvent()"
            >
              转雷达潜客
            </Button>
          </Space>
        </Card>
      </template>
    </Drawer>

    <Drawer
      v-model:open="evidenceOpen"
      destroy-on-close
      title="企业信号证据"
      width="920"
    >
      <Table
        :columns="evidenceColumns"
        :data-source="evidenceItems"
        :loading="evidenceLoading"
        :pagination="false"
        row-key="evidenceId"
        :scroll="{ x: 1040 }"
        size="small"
      />
      <Card
        v-for="item in evidenceItems"
        :key="item.evidenceId"
        class="mt-3"
        :title="item.sourceTitle"
      >
        <p class="text-xs text-gray-500">{{ item.sourceLink }}</p>
        <p class="evidence-text">{{ item.rawText || '-' }}</p>
      </Card>
    </Drawer>
  </div>
</template>

<style lang="less" scoped>
.signal-events-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.signal-table-card {
  min-height: 0;
  flex: 1;
}

.signal-title-cell,
.signal-source-cell {
  max-width: 260px;
}

.signal-source-cell {
  overflow: hidden;
  text-overflow: ellipsis;
}

.evidence-text {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.signal-event-detail {
  :deep(.ant-descriptions-item-content) {
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}

.radar-search-form {
  row-gap: 12px;
}

.radar-filter-control {
  width: 180px;
  min-width: 180px;
}

.radar-filter-keyword {
  width: 320px;
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
}

:deep(.ant-table-tbody > tr > td) {
  color: var(--ant-color-text);
  font-size: 14px;
  line-height: 22px;
}
</style>
