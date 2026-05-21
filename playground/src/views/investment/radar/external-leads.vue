<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  ExternalLead,
  ExternalLeadConfidenceLevel,
  ExternalLeadDemandType,
  ExternalLeadDetail,
  ExternalLeadStatus,
  LeadEvidence,
  RadarSalesUser,
} from '#/api/investment';

import { computed, h, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Select,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  convertExternalLeadToRadarLead,
  getExternalLeadDetail,
  getExternalLeadEvidenceList,
  getExternalLeadList,
  getRadarSalesUserList,
  updateExternalLead,
} from '#/api/investment';

defineOptions({ name: 'InvestmentRadarExternalLeads' });

const router = useRouter();
const loading = ref(false);
const detailLoading = ref(false);
const evidenceLoading = ref(false);
const saving = ref(false);
const convertingLeadId = ref<null | number>(null);
const items = ref<ExternalLead[]>([]);
const currentLead = ref<ExternalLeadDetail | null>(null);
const evidenceItems = ref<LeadEvidence[]>([]);
const salesUsers = ref<RadarSalesUser[]>([]);
const detailOpen = ref(false);
const evidenceOpen = ref(false);
const pagination = ref({
  current: 1,
  pageSize: 20,
  showSizeChanger: true,
  total: 0,
});
const searchForm = ref({
  confidenceLevel: '',
  demandType: '',
  industryName: '',
  keyword: '',
  regionCity: '',
  sourceName: '',
  sourceType: '',
  status: '',
});
const editForm = ref<{
  invalidReason?: string;
  ownerUserId?: number;
  remark?: string;
  status: ExternalLeadStatus;
}>({
  invalidReason: undefined,
  ownerUserId: undefined,
  remark: undefined,
  status: 'NEW',
});

const statusOptions: Array<{ label: string; value: '' | ExternalLeadStatus }> =
  [
    { label: '全部', value: '' },
    { label: '新线索', value: 'NEW' },
    { label: '待复核', value: 'PENDING_REVIEW' },
    { label: '已分配', value: 'ASSIGNED' },
    { label: '跟进中', value: 'FOLLOWING' },
    { label: '已带看', value: 'VISITED' },
    { label: '已成交', value: 'WON' },
    { label: '无效', value: 'INVALID' },
  ];
const confidenceOptions: Array<{
  label: string;
  value: '' | ExternalLeadConfidenceLevel;
}> = [
  { label: '全部', value: '' },
  { label: '高', value: 'HIGH' },
  { label: '中', value: 'MEDIUM' },
  { label: '低', value: 'LOW' },
];
const demandTypeOptions: Array<{
  label: string;
  value: '' | ExternalLeadDemandType;
}> = [
  { label: '全部', value: '' },
  { label: '扩产', value: 'EXPAND' },
  { label: '新增产线', value: 'NEW_LINE' },
  { label: '搬迁', value: 'RELOCATION' },
  { label: '求租厂房', value: 'RENT_FACTORY' },
  { label: '未知', value: 'UNKNOWN' },
];
const sourceTypeOptions = [
  { label: '全部来源类型', value: '' },
  { label: '内部合同', value: 'INTERNAL_CONTRACT' },
  { label: '公开机会', value: 'PUBLIC_OPPORTUNITY' },
  { label: 'Demo', value: 'DEMO' },
];

const statusMeta: Record<ExternalLeadStatus, { color: string; label: string }> =
  {
    ASSIGNED: { color: 'blue', label: '已分配' },
    FOLLOWING: { color: 'processing', label: '跟进中' },
    INVALID: { color: 'red', label: '无效' },
    NEW: { color: 'default', label: '新线索' },
    PENDING_REVIEW: { color: 'orange', label: '待复核' },
    VISITED: { color: 'purple', label: '已带看' },
    WON: { color: 'green', label: '已成交' },
  };
const confidenceMeta: Record<
  ExternalLeadConfidenceLevel,
  { color: string; label: string }
> = {
  HIGH: { color: 'red', label: '高' },
  LOW: { color: 'default', label: '低' },
  MEDIUM: { color: 'gold', label: '中' },
};
const demandTypeLabel: Record<ExternalLeadDemandType, string> = {
  EXPAND: '扩产',
  NEW_LINE: '新增产线',
  RELOCATION: '搬迁',
  RENT_FACTORY: '求租厂房',
  UNKNOWN: '未知',
};

const tableLocale = {
  emptyText: '暂无外部公开线索',
};

const currentEvidenceCount = computed(() => {
  const detailEvidenceCount = currentLead.value?.evidences?.length || 0;
  if (detailEvidenceCount > 0) {
    return detailEvidenceCount;
  }
  if (evidenceItems.value.length > 0) {
    return evidenceItems.value.length;
  }
  return currentLead.value?.evidenceCount || 0;
});
const salesUserOptions = computed(() =>
  salesUsers.value.map((item) => ({
    label: `${item.userName}${item.parkName ? ` · ${item.parkName}` : ''}`,
    value: item.userId,
  })),
);

function formatOptionalTime(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

function getStatusMeta(status: ExternalLeadStatus) {
  return statusMeta[status] || { color: 'default', label: status };
}

function buildQuery() {
  return {
    confidenceLevel: searchForm.value.confidenceLevel || undefined,
    currentPage: pagination.value.current,
    demandType: searchForm.value.demandType || undefined,
    industryName: searchForm.value.industryName || undefined,
    keyword: searchForm.value.keyword || undefined,
    pageSize: pagination.value.pageSize,
    regionCity: searchForm.value.regionCity || undefined,
    sourceName: searchForm.value.sourceName || undefined,
    sourceType: searchForm.value.sourceType || undefined,
    status: searchForm.value.status || undefined,
  };
}

async function loadLeads() {
  loading.value = true;
  try {
    const result = await getExternalLeadList(buildQuery());
    items.value = result.items;
    pagination.value.total = result.total;
  } catch (error) {
    console.error('load external leads failed:', error);
    message.error('外部公开线索加载失败');
  } finally {
    loading.value = false;
  }
}

async function loadSalesUsers() {
  try {
    const result = await getRadarSalesUserList();
    salesUsers.value = Array.isArray(result.items) ? result.items : [];
  } catch (error) {
    console.error('load radar sales users failed:', error);
    salesUsers.value = [];
  }
}

function searchLeads() {
  pagination.value.current = 1;
  void loadLeads();
}

function resetSearch() {
  searchForm.value = {
    confidenceLevel: '',
    demandType: '',
    industryName: '',
    keyword: '',
    regionCity: '',
    sourceName: '',
    sourceType: '',
    status: '',
  };
  searchLeads();
}

function handleTableChange(page: { current?: number; pageSize?: number }) {
  pagination.value.current = page.current || 1;
  pagination.value.pageSize = page.pageSize || 20;
  void loadLeads();
}

function syncEditForm(lead: ExternalLeadDetail) {
  editForm.value = {
    invalidReason: lead.invalidReason || undefined,
    ownerUserId: lead.ownerUserId || undefined,
    remark: lead.remark || undefined,
    status: lead.status,
  };
}

function createPreviewDetail(record: ExternalLead): ExternalLeadDetail {
  return {
    ...record,
    evidences: [],
  };
}

async function openDetail(record: ExternalLead) {
  detailOpen.value = true;
  detailLoading.value = true;
  const previewDetail = createPreviewDetail(record);
  currentLead.value = previewDetail;
  evidenceItems.value = [];
  syncEditForm(previewDetail);
  try {
    const detail = await getExternalLeadDetail(record.leadId);
    currentLead.value = detail;
    evidenceItems.value = detail.evidences || [];
    syncEditForm(detail);
  } catch (error) {
    console.error('load external lead detail failed:', error);
    message.error('外部公开线索详情加载失败');
  } finally {
    detailLoading.value = false;
  }
}

async function openEvidence(record?: ExternalLead) {
  const target = record || currentLead.value;
  if (!target) {
    return;
  }
  evidenceOpen.value = true;
  evidenceLoading.value = true;
  try {
    const result = await getExternalLeadEvidenceList(target.leadId);
    evidenceItems.value = result.items;
  } catch (error) {
    console.error('load external lead evidence failed:', error);
    message.error('证据加载失败');
  } finally {
    evidenceLoading.value = false;
  }
}

async function saveLead() {
  if (!currentLead.value || saving.value) {
    return;
  }
  saving.value = true;
  try {
    await updateExternalLead(currentLead.value.leadId, {
      invalidReason: editForm.value.invalidReason || null,
      ownerUserId: editForm.value.ownerUserId || null,
      remark: editForm.value.remark || null,
      status: editForm.value.status,
    });
    message.success('外部公开线索已更新');
    const detail = await getExternalLeadDetail(currentLead.value.leadId);
    currentLead.value = detail;
    syncEditForm(detail);
    await loadLeads();
  } catch (error) {
    console.error('save external lead failed:', error);
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
}

async function convertLead(record?: ExternalLead) {
  const target = record || currentLead.value;
  if (!target || convertingLeadId.value !== null) {
    return;
  }
  convertingLeadId.value = target.leadId;
  try {
    const result = await convertExternalLeadToRadarLead(target.leadId, {
      ownerUserId: editForm.value.ownerUserId || target.ownerUserId || null,
      remark: editForm.value.remark || '外部公开线索确认有效，转入雷达潜客',
    });
    message.success(result.reused ? '已复用现有雷达潜客' : '已转为雷达潜客');
    await loadLeads();
    router.push(`/investment/radar/${result.radarLeadId}`);
  } catch (error) {
    console.error('convert external lead failed:', error);
    message.error('转雷达潜客失败');
  } finally {
    if (convertingLeadId.value === target.leadId) {
      convertingLeadId.value = null;
    }
  }
}

function isConvertingLead(leadId?: null | number) {
  return (
    leadId !== null && leadId !== undefined && convertingLeadId.value === leadId
  );
}

function renderStatus(status: ExternalLeadStatus) {
  const meta = getStatusMeta(status);
  return h(Tag, { color: meta.color }, () => meta.label);
}

function renderConfidence(level: ExternalLeadConfidenceLevel) {
  const meta = confidenceMeta[level] || { color: 'default', label: level };
  return h(Tag, { color: meta.color }, () => meta.label);
}

const columns: TableColumnsType<ExternalLead> = [
  {
    customRender: ({ record }) =>
      h('div', { class: 'external-lead-title' }, [
        h(
          'div',
          {
            class: 'external-lead-primary',
            title: record.companyName,
          },
          record.companyName,
        ),
        h(
          'div',
          {
            class: 'external-lead-secondary',
            title: record.leadTitle,
          },
          record.leadTitle || '-',
        ),
      ]),
    dataIndex: 'companyName',
    key: 'companyName',
    title: '企业 / 线索',
    width: 260,
  },
  {
    customRender: ({ record }) => renderStatus(record.status),
    dataIndex: 'status',
    key: 'status',
    title: '状态',
    width: 110,
  },
  {
    customRender: ({ record }) => renderConfidence(record.confidenceLevel),
    dataIndex: 'confidenceLevel',
    key: 'confidenceLevel',
    title: '置信度',
    width: 100,
  },
  {
    customRender: ({ record }) =>
      demandTypeLabel[record.demandType] || record.demandType,
    dataIndex: 'demandType',
    key: 'demandType',
    title: '需求类型',
    width: 110,
  },
  {
    dataIndex: 'confidenceScore',
    key: 'confidenceScore',
    title: '分数',
    width: 80,
  },
  {
    customRender: ({ record }) =>
      [record.regionCity, record.regionDistrict].filter(Boolean).join(' / ') ||
      '-',
    key: 'region',
    title: '地区',
    width: 150,
  },
  {
    customRender: ({ record }) => record.industryName || '-',
    dataIndex: 'industryName',
    key: 'industryName',
    title: '行业',
    width: 120,
  },
  {
    customRender: ({ record }) =>
      h('div', { class: 'external-source-cell' }, [
        h(
          'div',
          {
            class: 'external-lead-primary',
            title: record.sourceName || '-',
          },
          record.sourceName || '-',
        ),
        h(
          'div',
          {
            class: 'external-lead-secondary',
            title: record.sourceUrl || '-',
          },
          record.sourceUrl || '-',
        ),
      ]),
    dataIndex: 'sourceName',
    key: 'sourceName',
    title: '来源',
    width: 240,
  },
  {
    customRender: ({ record }) => {
      const count = record.evidenceCount || 0;
      return h(Tag, { color: count > 0 ? 'blue' : 'default' }, () =>
        count > 0 ? `已采集 ${count} 条` : '暂无证据',
      );
    },
    dataIndex: 'evidenceCount',
    key: 'evidenceCount',
    title: '证据链',
    width: 130,
  },
  {
    customRender: ({ record }) =>
      record.convertedRadarLeadId ? '已转化' : '-',
    key: 'convertedRadarLeadId',
    title: '雷达潜客',
    width: 110,
  },
  {
    customRender: ({ record }) => formatOptionalTime(record.crawledAt),
    key: 'crawledAt',
    title: '抓取时间',
    width: 170,
  },
  {
    customRender: ({ record }) =>
      h(Space, { class: 'external-lead-actions', size: 4 }, () => [
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
            disabled: Boolean(record.convertedRadarLeadId),
            loading: isConvertingLead(record.leadId),
            onClick: () => void convertLead(record),
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

const evidenceColumns: TableColumnsType<LeadEvidence> = [
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
  void loadLeads();
  void loadSalesUsers();
});
</script>

<template>
  <div class="external-leads-pane">
    <Card class="mb-3" title="筛选">
      <Form class="radar-search-form" layout="inline">
        <Form.Item label="关键词">
          <Input
            v-model:value="searchForm.keyword"
            allow-clear
            class="radar-filter-keyword"
            placeholder="企业 / 标题 / 来源"
            @press-enter="searchLeads"
          />
        </Form.Item>
        <Form.Item label="状态">
          <Select
            v-model:value="searchForm.status"
            class="radar-filter-control"
            :options="statusOptions"
          />
        </Form.Item>
        <Form.Item label="置信度">
          <Select
            v-model:value="searchForm.confidenceLevel"
            class="radar-filter-control"
            :options="confidenceOptions"
          />
        </Form.Item>
        <Form.Item label="需求">
          <Select
            v-model:value="searchForm.demandType"
            class="radar-filter-control"
            :options="demandTypeOptions"
          />
        </Form.Item>
        <Form.Item label="地区">
          <Input
            v-model:value="searchForm.regionCity"
            allow-clear
            class="radar-filter-control"
            @press-enter="searchLeads"
          />
        </Form.Item>
        <Form.Item label="行业">
          <Input
            v-model:value="searchForm.industryName"
            allow-clear
            class="radar-filter-control"
            @press-enter="searchLeads"
          />
        </Form.Item>
        <Form.Item label="来源">
          <Input
            v-model:value="searchForm.sourceName"
            allow-clear
            class="radar-filter-control"
            @press-enter="searchLeads"
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
            <Button type="primary" @click="searchLeads">查询</Button>
            <Button @click="resetSearch">重置</Button>
            <Button :loading="loading" @click="loadLeads">刷新</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>

    <Card class="external-leads-table-card" title="外部公开线索">
      <Table
        bordered
        class="external-leads-table"
        :columns="columns"
        :data-source="items"
        :loading="loading"
        :locale="tableLocale"
        :pagination="pagination"
        row-key="leadId"
        :scroll="{ x: 1720 }"
        size="small"
        table-layout="fixed"
        @change="handleTableChange"
      />
    </Card>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      title="外部公开线索详情"
      width="860"
    >
      <Spin :spinning="detailLoading">
        <template v-if="currentLead">
          <Descriptions
            bordered
            :column="2"
            class="external-lead-detail"
            size="small"
          >
            <Descriptions.Item label="企业">
              {{ currentLead.companyName }}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag :color="getStatusMeta(currentLead.status).color">
                {{ getStatusMeta(currentLead.status).label }}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="线索标题" :span="2">
              {{ currentLead.leadTitle }}
            </Descriptions.Item>
            <Descriptions.Item label="系统判断" :span="2">
              {{ currentLead.summary || '-' }}
            </Descriptions.Item>
            <Descriptions.Item label="来源" :span="2">
              {{ currentLead.sourceName }} / {{ currentLead.sourceUrl }}
            </Descriptions.Item>
            <Descriptions.Item label="证据数">
              {{ currentEvidenceCount }}
            </Descriptions.Item>
            <Descriptions.Item label="命中词">
              {{ currentLead.hitKeywords.join(', ') || '-' }}
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
              <Form.Item label="负责人">
                <Select
                  v-model:value="editForm.ownerUserId"
                  allow-clear
                  class="w-full"
                  option-filter-prop="label"
                  :options="salesUserOptions"
                  placeholder="选择负责人"
                  show-search
                />
              </Form.Item>
              <Form.Item label="备注">
                <Input.TextArea
                  v-model:value="editForm.remark"
                  :auto-size="{ minRows: 2, maxRows: 5 }"
                />
              </Form.Item>
              <Form.Item label="无效原因">
                <Input.TextArea
                  v-model:value="editForm.invalidReason"
                  :auto-size="{ minRows: 2, maxRows: 5 }"
                />
              </Form.Item>
            </Form>
            <Space>
              <Button type="primary" :loading="saving" @click="saveLead">
                保存
              </Button>
              <Button @click="openEvidence()">查看证据原文</Button>
              <Button
                type="primary"
                :disabled="Boolean(currentLead.convertedRadarLeadId)"
                :loading="isConvertingLead(currentLead.leadId)"
                @click="convertLead()"
              >
                一键转雷达潜客
              </Button>
            </Space>
          </Card>
        </template>
        <Empty v-else description="暂无详情数据" />
      </Spin>
    </Drawer>

    <Drawer
      v-model:open="evidenceOpen"
      destroy-on-close
      title="证据链"
      width="920"
    >
      <Table
        bordered
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
.external-leads-pane {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.external-leads-table-card {
  flex: none;
}

.external-lead-title,
.external-source-cell {
  display: flex;
  max-width: 100%;
  min-height: 40px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
}

.external-lead-primary,
.external-lead-secondary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.external-lead-primary {
  color: var(--ant-color-text);
  font-weight: 500;
  line-height: 20px;
}

.external-lead-secondary {
  color: var(--ant-color-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.external-lead-actions {
  white-space: nowrap;
}

.evidence-text {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.external-lead-detail {
  :deep(.ant-descriptions-item-content) {
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}

.radar-search-form {
  align-items: center;
  row-gap: 8px;
}

.radar-search-form :deep(.ant-form-item) {
  align-items: center;
  margin-bottom: 0;
}

.radar-search-form :deep(.ant-form-item-control-input) {
  min-height: 32px;
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
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-selection-item),
.radar-search-form :deep(.ant-select-selection-placeholder) {
  font-size: 14px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-select-single .ant-select-selection-search-input),
.radar-search-form :deep(.ant-btn) {
  height: 32px;
}

.radar-search-form :deep(.ant-input),
.radar-search-form :deep(.ant-input-affix-wrapper),
.radar-search-form :deep(.ant-select-single .ant-select-selector),
.radar-search-form :deep(.ant-btn) {
  line-height: 30px;
}

.radar-search-form :deep(.ant-input-affix-wrapper) {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  padding-block: 0;
}

.radar-search-form :deep(.ant-input-affix-wrapper > input.ant-input) {
  height: 30px;
  line-height: 30px;
}

.radar-search-form :deep(.ant-select-single .ant-select-selector) {
  align-items: center;
  display: flex;
}

.radar-search-form :deep(.ant-select-single .ant-select-selection-item),
.radar-search-form :deep(.ant-select-single .ant-select-selection-placeholder) {
  line-height: 30px;
}

.radar-search-form :deep(.ant-form-item-label > label) {
  color: var(--ant-color-text);
  font-size: 14px;
  min-height: 32px;
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
  height: 56px;
  line-height: 22px;
  padding-bottom: 8px;
  padding-top: 8px;
  text-align: center;
  vertical-align: middle;
}

.external-leads-table :deep(.ant-table-cell) {
  overflow: hidden;
}

.external-leads-table :deep(.ant-table-tbody > tr > td) {
  max-height: 56px;
}
</style>
