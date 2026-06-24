<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  previewAmountBillCollectionSms,
  sendAmountBillCollectionSms,
} from '#/api/bill';

import { formatAmountBillMoney } from '../data';

type CollectionType = 'final_30' | 'overdue_10' | 'payment_reminder';

interface CollectionSmsCandidate {
  billId: number;
  canSend: boolean;
  collectionStatusLabel: string;
  justSent?: boolean;
  lastSentAt?: string;
  message: string;
  parkName?: string;
  phoneNumber?: string;
  projectName: string;
  reason?: string;
  receiptAmount: number;
  remainingAmount: number;
  sentCount?: number;
  smsCompanyName?: string;
  smsTemplateId?: string;
  tenantName: string;
  totalFee: number;
}

interface CollectionSmsPreviewResult {
  items: CollectionSmsCandidate[];
  summary: {
    candidateCount: number;
    sendableCount: number;
    totalRemainingAmount: number;
  };
}

const open = ref(false);
const previewLoading = ref(false);
const sendLoading = ref(false);
const candidates = ref<CollectionSmsCandidate[]>([]);
const selectedBillIds = ref<number[]>([]);
const detailOpen = ref(false);
const detailCandidate = ref<CollectionSmsCandidate>();
const currentFilters = ref<Record<string, any>>({});
const parkSearchText = ref('');
const parkSelectSearchText = ref('');
const tablePage = ref(1);

interface AutoCollectionConfig {
  collectionType: CollectionType;
  description: string;
  dueDate: string;
  label: string;
  overdueDays?: number;
  todayText: string;
  triggerText: string;
}

const modalWidth = 'min(1680px, calc(100vw - 48px))';
const tablePageSize = 10;
const tableScroll = { x: 1640, y: 'calc(100vh - 430px)' };
const autoConfig = ref<AutoCollectionConfig>(resolveAutoCollectionConfig());

const columns: TableColumnsType<CollectionSmsCandidate> = [
  { dataIndex: 'parkName', fixed: 'left', title: '园区', width: 150 },
  { dataIndex: 'smsCompanyName', title: '短信主体', width: 230 },
  { dataIndex: 'tenantName', title: '租户/手机号', width: 220 },
  { dataIndex: 'projectName', title: '账期/项目', width: 260 },
  { dataIndex: 'amountSummary', title: '金额', width: 180 },
  { dataIndex: 'collectionStatusLabel', title: '状态', width: 100 },
  { dataIndex: 'sendState', title: '可发送', width: 220 },
  { dataIndex: 'sendHistory', title: '发送记录', width: 150 },
  { dataIndex: 'message', title: '短信预览', width: 330 },
];

const summary = computed(() => {
  const items = displayedCandidates.value;
  return {
    candidateCount: items.length,
    sendableCount: items.filter((item) => item.canSend).length,
    totalRemainingAmount: items.reduce(
      (sum, item) => sum + Number(item.remainingAmount || 0),
      0,
    ),
  };
});

const selectedSendableCount = computed(() => {
  const selected = new Set(selectedBillIds.value);
  return displayedCandidates.value.filter(
    (item) => selected.has(item.billId) && item.canSend,
  ).length;
});

const detailRows = computed(() => {
  const item = detailCandidate.value;
  if (!item) {
    return [];
  }
  return [
    { label: '园区', value: item.parkName || '-' },
    { label: '短信主体', value: item.smsCompanyName || '-' },
    { label: '模板ID', value: item.smsTemplateId || '-' },
    { label: '租户', value: item.tenantName || '-' },
    { label: '手机号', value: item.phoneNumber || '无手机号' },
    { label: '账期/项目', value: item.projectName || '-' },
    { label: '收款状态', value: item.collectionStatusLabel || '-' },
    { label: '应收金额', value: formatAmountBillMoney(item.totalFee) },
    { label: '已收金额', value: formatAmountBillMoney(item.receiptAmount) },
    { label: '未收金额', value: formatAmountBillMoney(item.remainingAmount) },
    {
      label: '可发送',
      value: item.canSend ? '可发送' : item.reason || '不可发送',
    },
    { label: '发送记录', value: getSendHistoryText(item) },
    { label: '短信内容', message: true, value: item.message || '-' },
  ];
});

const rowSelection = computed(() => ({
  getCheckboxProps: (record: CollectionSmsCandidate) => ({
    disabled: !record.canSend,
  }),
  onChange: (keys: Array<number | string>) => {
    selectedBillIds.value = keys.map(Number);
  },
  selectedRowKeys: selectedBillIds.value,
}));

const parkSearchOptions = computed(() => {
  const parkNameMap = new Map<string, string>();
  for (const item of candidates.value) {
    const parkName = String(item.parkName || '').trim();
    if (parkName) {
      parkNameMap.set(parkName.toLocaleLowerCase('zh-CN'), parkName);
    }
  }
  return [...parkNameMap.values()]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
    .map((parkName) => ({
      label: parkName,
      value: parkName,
    }));
});

const displayedCandidates = computed(() => {
  const keyword = parkSearchText.value.trim().toLowerCase();
  if (!keyword) {
    return candidates.value;
  }
  return candidates.value.filter((item) =>
    String(item.parkName || '')
      .toLowerCase()
      .includes(keyword),
  );
});

const tablePagination = computed(() => ({
  current: tablePage.value,
  pageSize: tablePageSize,
  showSizeChanger: false,
}));

watch(parkSearchText, () => {
  tablePage.value = 1;
  selectedBillIds.value = getSelectableBillIds();
});

watch(displayedCandidates, (items) => {
  const maxPage = Math.max(1, Math.ceil(items.length / tablePageSize));
  if (tablePage.value > maxPage) {
    tablePage.value = 1;
  }
});

function normalizePreviewResult(result: any): CollectionSmsPreviewResult {
  return {
    summary: {
      candidateCount: Number(result?.summary?.candidateCount || 0),
      sendableCount: Number(result?.summary?.sendableCount || 0),
      totalRemainingAmount: Number(result?.summary?.totalRemainingAmount || 0),
    },
    items: Array.isArray(result?.items) ? result.items : [],
  };
}

function getSentRank(item: CollectionSmsCandidate) {
  return item.justSent || Number(item.sentCount || 0) > 0 ? 1 : 0;
}

function getLastSentTime(item: CollectionSmsCandidate) {
  if (!item.lastSentAt) {
    return 0;
  }
  const time = new Date(item.lastSentAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortCollectionSmsCandidates(items: CollectionSmsCandidate[]) {
  return [...items].sort((left, right) => {
    const sentRankDiff = getSentRank(left) - getSentRank(right);
    if (sentRankDiff !== 0) {
      return sentRankDiff;
    }

    const sendableDiff = Number(right.canSend) - Number(left.canSend);
    if (sendableDiff !== 0) {
      return sendableDiff;
    }

    const sentTimeDiff = getLastSentTime(right) - getLastSentTime(left);
    if (sentTimeDiff !== 0) {
      return sentTimeDiff;
    }

    return Number(right.billId) - Number(left.billId);
  });
}

function getSelectableBillIds(items = displayedCandidates.value) {
  return items
    .filter((item) => item.canSend && !item.sentCount && !item.justSent)
    .map((item) => item.billId);
}

function syncSelectedBillIdsWithVisibleItems() {
  const visibleBillIds = new Set(
    displayedCandidates.value.map((item) => item.billId),
  );
  selectedBillIds.value = selectedBillIds.value.filter((billId) =>
    visibleBillIds.has(billId),
  );
}

function filterParkSearchOption(inputValue: string, option: any) {
  const keyword = inputValue.trim().toLowerCase();
  return String(option?.value || '')
    .toLowerCase()
    .includes(keyword);
}

function normalizeParkSearchValue(value: unknown) {
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value?: unknown }).value || '');
  }
  return String(value || '');
}

function formatSendTime(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function getSendHistoryText(item: CollectionSmsCandidate) {
  if (item.justSent) {
    return `本次已发送，共 ${Number(item.sentCount || 0)} 次`;
  }
  if (!item.sentCount) {
    return '未发送';
  }
  const lastSentText = item.lastSentAt
    ? `，最近 ${formatSendTime(item.lastSentAt)}`
    : '';
  return `已发送 ${item.sentCount} 次${lastSentText}`;
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  const errorRecord = error as any;
  const responseData = errorRecord?.response?.data;
  const candidates = [
    responseData?.message,
    responseData?.error,
    errorRecord?.data?.message,
    errorRecord?.data?.error,
    errorRecord?.message,
  ];
  const errorMessage = candidates.find(
    (item) => typeof item === 'string' && item.trim(),
  );
  return errorMessage || fallback;
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function getBeijingDateParts() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date())) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }
  return {
    day: parts.day || 1,
    month: parts.month || 1,
    year: parts.year || new Date().getFullYear(),
  };
}

function formatBeijingDate(year: number, month: number, day: number) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function resolveAutoCollectionConfig(): AutoCollectionConfig {
  const parts = getBeijingDateParts();
  const todayText = formatBeijingDate(parts.year, parts.month, parts.day);
  const dueDate = formatBeijingDate(parts.year, parts.month, 5);

  if (parts.day >= 30) {
    return {
      collectionType: 'final_30',
      description:
        '今天归入长期未结提醒阶段，系统自动使用对应费用提醒模板，不需要人工选择。',
      dueDate,
      label: '长期未结费用提醒',
      overdueDays: 30,
      todayText,
      triggerText: '每月30日 18:00',
    };
  }

  if (parts.day >= 10) {
    return {
      collectionType: 'overdue_10',
      description:
        '今天归入逾期提醒阶段，系统自动使用对应费用提醒模板，不需要人工选择。',
      dueDate,
      label: '逾期费用提醒',
      overdueDays: 10,
      todayText,
      triggerText: '每月10日 18:00',
    };
  }

  return {
    collectionType: 'payment_reminder',
    description:
      '今天归入缴费提醒阶段，系统自动使用对应费用提醒模板，不需要人工选择。',
    dueDate,
    label: '缴费费用提醒',
    todayText,
    triggerText: '每月5日 18:00',
  };
}

function syncAutoConfig() {
  autoConfig.value = resolveAutoCollectionConfig();
}

function buildRequestPayload() {
  const config = autoConfig.value;
  return {
    collectionType: config.collectionType,
    dueDate: config.dueDate,
    filters: {
      ...currentFilters.value,
      collectionStatus: currentFilters.value.collectionStatus || 'unreceived',
    },
    overdueDays:
      config.collectionType === 'payment_reminder'
        ? undefined
        : config.overdueDays,
  };
}

function handleParkSearchSelect(value: unknown = '') {
  const nextValue = normalizeParkSearchValue(value);
  parkSearchText.value = nextValue;
  parkSelectSearchText.value = '';
}

function handleParkSearchInput(value: unknown = '') {
  const nextValue = normalizeParkSearchValue(value);
  parkSearchText.value = nextValue;
  parkSelectSearchText.value = nextValue;
}

function handleParkSearchClear() {
  parkSearchText.value = '';
  parkSelectSearchText.value = '';
}

function handleParkSearchDropdownVisibleChange(visible: boolean) {
  if (visible) {
    parkSelectSearchText.value = '';
  }
}

function handleTableChange(pagination: { current?: number }) {
  tablePage.value = Number(pagination.current || 1);
}

function openCandidateDetail(
  record: CollectionSmsCandidate | Record<string, any>,
) {
  detailCandidate.value = record as CollectionSmsCandidate;
  detailOpen.value = true;
}

function closeCandidateDetail() {
  detailOpen.value = false;
}

function getCandidateRowProps(record: CollectionSmsCandidate) {
  return {
    class: 'collection-sms-clickable-row',
    onClick: (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          '.ant-checkbox, .ant-checkbox-wrapper, button, a, .ant-pagination',
        )
      ) {
        return;
      }
      openCandidateDetail(record);
    },
  };
}

async function handlePreview() {
  syncAutoConfig();
  previewLoading.value = true;
  try {
    const result = normalizePreviewResult(
      await previewAmountBillCollectionSms(buildRequestPayload()),
    );
    const sortedItems = sortCollectionSmsCandidates(result.items);
    candidates.value = sortedItems;
    tablePage.value = 1;
    selectedBillIds.value = getSelectableBillIds();
    if (result.items.length === 0) {
      message.info('当前筛选条件下没有未收或部分收款账单');
    }
  } catch (error) {
    console.error('预览催收短信失败:', error);
    message.error(
      getRequestErrorMessage(error, '预览催收短信失败，请稍后重试'),
    );
  } finally {
    previewLoading.value = false;
  }
}

async function handleSend() {
  syncSelectedBillIdsWithVisibleItems();
  const billIds = selectedBillIds.value.filter((billId) =>
    displayedCandidates.value.some(
      (item) => item.billId === billId && item.canSend,
    ),
  );
  if (billIds.length === 0) {
    message.warning('请至少选择一条可发送的账单');
    return;
  }

  Modal.confirm({
    cancelText: '取消',
    centered: true,
    content:
      '短信发送只做催缴提醒，不会自动确认收款，也不会修改账单收款金额或收款时间。房租是否到账仍需园区经理或财务在后台确认。',
    okText: '确认发送',
    async onOk() {
      sendLoading.value = true;
      try {
        const result = await sendAmountBillCollectionSms({
          ...buildRequestPayload(),
          billIds,
        });
        const successCount = Number(result?.successCount || 0);
        const failedCount = Number(result?.failedCount || 0);
        if (failedCount > 0) {
          message.warning(
            `催收短信发送完成，成功 ${successCount} 条，失败 ${failedCount} 条`,
          );
        } else {
          message.success(`催收短信发送成功 ${successCount} 条`);
        }
        const successBillIds = new Set(
          (Array.isArray(result?.results) ? result.results : [])
            .filter((item: any) => item?.success)
            .map((item: any) => Number(item.billId)),
        );
        if (successBillIds.size > 0) {
          const nowText = new Date().toISOString();
          candidates.value = sortCollectionSmsCandidates(
            candidates.value.map((item) =>
              successBillIds.has(item.billId)
                ? {
                    ...item,
                    justSent: true,
                    lastSentAt: nowText,
                    sentCount: Number(item.sentCount || 0) + 1,
                  }
                : item,
            ),
          );
          selectedBillIds.value = selectedBillIds.value.filter(
            (billId) => !successBillIds.has(billId),
          );
        }
      } catch (error) {
        console.error('发送催收短信失败:', error);
        message.error(
          getRequestErrorMessage(error, '发送催收短信失败，请稍后重试'),
        );
      } finally {
        sendLoading.value = false;
      }
    },
    title: `确认发送 ${billIds.length} 条催收短信`,
  });
}

function resetForm() {
  syncAutoConfig();
  candidates.value = [];
  selectedBillIds.value = [];
  detailOpen.value = false;
  detailCandidate.value = undefined;
  parkSearchText.value = '';
  parkSelectSearchText.value = '';
  tablePage.value = 1;
}

function show(filters: Record<string, any> = {}) {
  currentFilters.value = { ...filters };
  resetForm();
  open.value = true;
  void handlePreview();
}

defineExpose({ open: show });
</script>

<template>
  <Modal
    v-model:open="open"
    :footer="null"
    :mask-closable="false"
    :width="modalWidth"
    wrap-class-name="collection-sms-modal-wrap"
    title="催收短信"
  >
    <Alert
      class="mb-4"
      message="后台会按北京时间每月5日、10日、30日18:00自动发送；当前弹窗仅用于查看、验收或人工补发，不自动确认收款，也不修改账单状态。"
      show-icon
      type="warning"
    />

    <Form layout="inline" class="collection-sms-toolbar mb-4">
      <Form.Item label="系统识别">
        <div class="collection-sms-auto-rule">
          <Tag color="blue">{{ autoConfig.label }}</Tag>
          <Tag color="green">后台自动发送</Tag>
          <span>北京时间 {{ autoConfig.todayText }}</span>
          <span>自动发送时间 {{ autoConfig.triggerText }}</span>
          <span>{{ autoConfig.description }}</span>
        </div>
      </Form.Item>
      <Form.Item>
        <Button :loading="previewLoading" @click="handlePreview">
          重新预览
        </Button>
      </Form.Item>
    </Form>

    <div
      class="collection-sms-summary mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-600"
    >
      <span class="collection-sms-filter-label">园区搜索</span>
      <Select
        allow-clear
        class="collection-sms-park-search"
        :filter-option="filterParkSearchOption"
        :options="parkSearchOptions"
        placeholder="下拉或输入园区"
        :search-value="parkSelectSearchText"
        show-search
        :value="parkSearchText || undefined"
        @change="handleParkSearchSelect"
        @clear="handleParkSearchClear"
        @dropdown-visible-change="handleParkSearchDropdownVisibleChange"
        @search="handleParkSearchInput"
        @select="handleParkSearchSelect"
      />
      <Tag color="blue">候选 {{ summary.candidateCount }}</Tag>
      <Tag v-if="parkSearchText" color="default">
        全部 {{ candidates.length }}
      </Tag>
      <Tag color="green">可发送 {{ summary.sendableCount }}</Tag>
      <Tag color="red">
        未收 {{ formatAmountBillMoney(summary.totalRemainingAmount) }}
      </Tag>
      <span>已选择 {{ selectedSendableCount }} 条</span>
    </div>

    <Table
      class="collection-sms-table"
      :columns="columns"
      :data-source="displayedCandidates"
      :loading="previewLoading"
      :pagination="tablePagination"
      :row-key="(record) => record.billId"
      :row-selection="rowSelection"
      :custom-row="getCandidateRowProps"
      bordered
      @change="handleTableChange"
      size="small"
      :scroll="tableScroll"
      table-layout="fixed"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'tenantName'">
          <div class="collection-sms-tenant">
            <div>{{ record.tenantName || '-' }}</div>
            <span>{{ record.phoneNumber || '无手机号' }}</span>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'smsCompanyName'">
          <div class="collection-sms-company">
            <div>{{ record.smsCompanyName || '-' }}</div>
            <span>{{ record.smsTemplateId || '未配置模板' }}</span>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'amountSummary'">
          <div class="collection-sms-amount">
            <span>应收 {{ formatAmountBillMoney(record.totalFee) }}</span>
            <span>已收 {{ formatAmountBillMoney(record.receiptAmount) }}</span>
            <span>
              未收 {{ formatAmountBillMoney(record.remainingAmount) }}
            </span>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'sendState'">
          <div
            class="collection-sms-send-state"
            :class="{ 'collection-sms-send-state-disabled': !record.canSend }"
          >
            <Tag v-if="record.canSend" color="green">可发送</Tag>
            <template v-else>
              <Tag color="red">不可发送</Tag>
              <span :title="record.reason || '不可发送'">
                {{ record.reason || '不可发送' }}
              </span>
            </template>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'sendHistory'">
          <div class="collection-sms-history">
            <Tag v-if="record.justSent" color="green">本次已发送</Tag>
            <Tag v-else-if="record.sentCount" color="blue">已发送</Tag>
            <Tag v-else>未发送</Tag>
            <span v-if="record.sentCount">
              {{ record.sentCount }} 次
              <template v-if="record.lastSentAt">
                / {{ formatSendTime(record.lastSentAt) }}
              </template>
            </span>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'message'">
          <div class="collection-sms-message">
            <div class="collection-sms-message-preview">
              {{ record.message }}
            </div>
            <Button
              class="collection-sms-detail-button"
              size="small"
              type="link"
              @click.stop="openCandidateDetail(record)"
            >
              查看详情
            </Button>
          </div>
        </template>
      </template>
    </Table>

    <div class="collection-sms-footer mt-4 flex justify-end gap-2">
      <Button @click="open = false">取消</Button>
      <Button
        type="primary"
        :disabled="selectedSendableCount === 0"
        :loading="sendLoading"
        @click="handleSend"
      >
        人工补发选中短信
      </Button>
    </div>

    <Modal
      v-model:open="detailOpen"
      :footer="null"
      :width="760"
      title="短信明细"
      @cancel="closeCandidateDetail"
    >
      <div v-if="detailCandidate" class="collection-sms-detail-list">
        <div
          v-for="row in detailRows"
          :key="row.label"
          class="collection-sms-detail-row"
          :class="{ 'collection-sms-detail-row-message': row.message }"
        >
          <div class="collection-sms-detail-label">{{ row.label }}</div>
          <div class="collection-sms-detail-value">{{ row.value }}</div>
        </div>
      </div>
    </Modal>
  </Modal>
</template>

<style lang="less" scoped>
.collection-sms-toolbar {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: #f7f9fc;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.collection-sms-toolbar :deep(.ant-form-item) {
  margin-bottom: 0;
}

.collection-sms-toolbar :deep(.ant-form-item-label) {
  font-weight: 600;
}

.collection-sms-auto-rule {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
  max-width: 100%;
  line-height: 1.6;
  color: #4b5563;
}

.collection-sms-auto-rule span {
  overflow-wrap: anywhere;
}

.collection-sms-summary {
  min-height: 32px;
}

.collection-sms-filter-label {
  font-weight: 600;
  color: #374151;
}

.collection-sms-park-search {
  width: min(320px, 100%);
}

.collection-sms-table {
  flex: 1;
  min-height: 0;
}

.collection-sms-table :deep(.ant-table) {
  font-size: 13px;
}

.collection-sms-table :deep(.ant-table-thead > tr > th) {
  padding: 10px 8px;
  font-weight: 600;
  color: #1f2937;
  background: #f8fafc;
}

.collection-sms-table :deep(.ant-table-tbody > tr > td) {
  padding: 12px 8px;
}

.collection-sms-table :deep(.ant-table-wrapper),
.collection-sms-table :deep(.ant-spin-nested-loading),
.collection-sms-table :deep(.ant-spin-container) {
  min-height: 0;
}

.collection-sms-table :deep(.ant-table-pagination) {
  margin: 16px 0 0;
}

.collection-sms-table :deep(.collection-sms-clickable-row) {
  cursor: pointer;
}

.collection-sms-table :deep(.collection-sms-clickable-row:hover > td) {
  background: #f5fbff;
}

.collection-sms-footer {
  flex-shrink: 0;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.collection-sms-tenant {
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
}

.collection-sms-tenant span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
}

.collection-sms-company {
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
}

.collection-sms-company span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #6b7280;
}

.collection-sms-amount {
  display: grid;
  gap: 2px;
  line-height: 1.5;
  white-space: normal;
}

.collection-sms-amount span:last-child {
  font-weight: 600;
  color: #cf1322;
}

.collection-sms-history {
  display: grid;
  gap: 4px;
  align-items: start;
  line-height: 1.5;
}

.collection-sms-history span {
  font-size: 12px;
  color: #6b7280;
}

.collection-sms-send-state {
  display: grid;
  gap: 6px;
  align-items: start;
  min-width: 0;
  line-height: 1.5;
}

.collection-sms-send-state :deep(.ant-tag) {
  width: fit-content;
  max-width: 100%;
  margin-right: 0;
}

.collection-sms-send-state span {
  display: -webkit-box;
  overflow: hidden;
  font-size: 12px;
  color: #991b1b;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.collection-sms-send-state-disabled {
  padding: 6px 8px;
  background: #fff7f7;
  border: 1px solid #ffd8d8;
  border-radius: 6px;
}

.collection-sms-message {
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.collection-sms-message-preview {
  display: -webkit-box;
  overflow: hidden;
  color: #374151;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 5;
}

.collection-sms-detail-button {
  height: 22px;
  padding: 0;
  font-size: 12px;
}

.collection-sms-detail-list {
  display: grid;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.collection-sms-detail-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  min-height: 40px;
  border-bottom: 1px solid #edf0f3;
}

.collection-sms-detail-row:last-child {
  border-bottom: 0;
}

.collection-sms-detail-row-message {
  grid-template-columns: 1fr;
}

.collection-sms-detail-label {
  padding: 10px 12px;
  font-weight: 600;
  color: #374151;
  background: #f8fafc;
  border-right: 1px solid #edf0f3;
}

.collection-sms-detail-row-message .collection-sms-detail-label {
  border-right: 0;
  border-bottom: 1px solid #edf0f3;
}

.collection-sms-detail-value {
  padding: 10px 12px;
  line-height: 1.7;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}

:deep(.ant-table-cell) {
  vertical-align: top;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

:global(.collection-sms-modal-wrap .ant-modal) {
  top: 32px;
  padding-bottom: 32px;
}

:global(.collection-sms-modal-wrap .ant-modal-body) {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
  overflow: hidden;
}

@media (max-width: 640px) {
  .collection-sms-park-search {
    width: 100%;
  }
}
</style>
