<script lang="ts" setup>
// 从本地类型定义中导入 ReimbursementItem 类型

import { defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Carousel,
  Col,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Pagination,
  Radio,
  Row,
  Select,
  Spin,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { getReimbursementDetail } from '#/api/reimbursement';
import { $t } from '#/locales';
import { openMobileImagePreview } from '#/utils/mobile-image-preview';

import { STATUS_MAP, useFormRules } from './data';
import { statusOptions, useReimbursementAudit } from './modules/type';

const AnalysisPanel = defineAsyncComponent(
  () => import('./modules/analysis-panel.vue'),
);

// 使用组合式函数
const {
  auditForm,
  availableStatusOptions,
  currentRecord,
  fetchParkOptions,
  fetchReimbursements,
  handleAuditSubmit,
  handleSearch,
  hasAuditPermission,
  isAmountOverLimit,
  isAuditModalVisible,
  loading,
  pagination,
  parkOptions,
  reimbursementList,
  resetSearch,
  searchForm,
  setListImageMode,
  showAuditModal,
  submitting,
} = useReimbursementAudit();

// 表单相关 for the audit modal
const auditModalFormRef = ref();
const activeTab = ref('audit');
const route = useRoute();

// 表单验证规则
const rules = useFormRules();

// 组件挂载时初始化
onMounted(() => {
  pagination.pageSize = 6;
  setListImageMode('summary');
  applyRouteFilters();
  fetchReimbursements();
  window.setTimeout(() => {
    void fetchParkOptions();
  }, 300);
});

function getRouteQueryNumber(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  const numberValue = Number(rawValue);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function applyRouteFilters() {
  const status = getRouteQueryNumber(route.query.status);
  const parkId = getRouteQueryNumber(route.query.parkId);

  if (status !== undefined) {
    searchForm.status = status;
  }
  if (parkId !== undefined && parkId > 0) {
    searchForm.park = String(parkId);
  }
}

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchReimbursements();
}

// Function to get status text and color
function getStatusDisplay(status: number) {
  return (
    STATUS_MAP[status as keyof typeof STATUS_MAP] || {
      color: 'default',
      text: '未知',
    }
  );
}

function getAuditWaitingDays(item: {
  auditWaitingDays?: number;
  createTime?: string;
  date?: string;
  status: number;
}) {
  if (item.status !== 0) {
    return 0;
  }
  if (typeof item.auditWaitingDays === 'number') {
    return Math.max(item.auditWaitingDays, 0);
  }

  const rawDate = item.date || item.createTime;
  const dateValue = rawDate ? new Date(rawDate).getTime() : Number.NaN;
  if (!Number.isFinite(dateValue)) {
    return 0;
  }

  return Math.max(
    Math.floor((Date.now() - dateValue) / (24 * 60 * 60 * 1000)),
    0,
  );
}

function getAuditPriorityDisplay(item: {
  amount: number;
  auditPriority?: 'done' | 'normal' | 'urgent' | 'warning';
  auditPriorityLabel?: string;
  auditPriorityReason?: string;
  auditWaitingDays?: number;
  createTime?: string;
  date?: string;
  status: number;
}) {
  if (item.status !== 0) {
    return null;
  }

  const waitingDays = getAuditWaitingDays(item);
  const amount = Number(item.amount || 0);
  let priority = item.auditPriority;
  if (!priority) {
    if (waitingDays >= 7 || amount >= 100_000) {
      priority = 'urgent';
    } else if (waitingDays >= 3 || amount >= 10_000) {
      priority = 'warning';
    } else {
      priority = 'normal';
    }
  }

  if (priority === 'urgent') {
    return {
      className: 'priority-urgent',
      color: 'red',
      label: item.auditPriorityLabel || '紧急处理',
      reason:
        item.auditPriorityReason ||
        (waitingDays >= 7 ? `已等待 ${waitingDays} 天` : '大额报销'),
    };
  }

  if (priority === 'warning') {
    return {
      className: 'priority-warning',
      color: 'orange',
      label: item.auditPriorityLabel || '重点关注',
      reason:
        item.auditPriorityReason ||
        (waitingDays >= 3 ? `已等待 ${waitingDays} 天` : '金额较高'),
    };
  }

  return {
    className: 'priority-normal',
    color: 'blue',
    label: item.auditPriorityLabel || '常规审核',
    reason:
      item.auditPriorityReason ||
      (waitingDays > 0 ? `已等待 ${waitingDays} 天` : '今日提交'),
  };
}

function formatAuditWaitingDays(item: {
  auditWaitingDays?: number;
  createTime?: string;
  date?: string;
  status: number;
}) {
  const waitingDays = getAuditWaitingDays(item);
  return waitingDays > 0 ? `${waitingDays} 天` : '今日提交';
}

function handleImagePreview(images: string[] | undefined, index: number) {
  if (!images || images.length === 0) {
    return;
  }
  void openMobileImagePreview(images, index);
}

function getRecordImageCount(item: { imageCount?: number; images?: string[] }) {
  return Number(item.imageCount ?? item.images?.length ?? 0);
}

async function handleRecordImagePreview(item: {
  id: number | string;
  imageCount?: number;
  images?: string[];
}) {
  const currentImages = item.images || [];
  if (
    item.imageCount &&
    item.imageCount > currentImages.length &&
    Number.isFinite(Number(item.id))
  ) {
    try {
      const detail = (await getReimbursementDetail(Number(item.id))) as any;
      const fullImages = Array.isArray(detail?.images) ? detail.images : [];
      if (fullImages.length > 0) {
        item.images = fullImages;
        item.imageCount = Number(detail.imageCount ?? fullImages.length);
        handleImagePreview(fullImages, 0);
        return;
      }
    } catch (error) {
      console.error('load reimbursement detail images failed:', error);
    }
  }

  handleImagePreview(currentImages, 0);
}

// Wrapper for showAuditModal to handle all cases
/* function triggerShowAuditModal(record: ReimbursementItem) {
  // If the record has been audited, it's a "View Details" action. Always show the modal.
  if (record.status !== 0) {
    showAuditModal(record);
    return;
  }

  // If the record is pending audit, check for permissions before showing the modal.
  if (isAmountOverLimit(Number(record.amount))) {
    message.warning('金额超出您的审核权限。');
    return;
  }

  // If permissions are sufficient, show the audit modal.
  showAuditModal(record);
} */
</script>

<template>
  <div class="mobile-audit-container">
    <!-- <header class="page-header">
      <h2 class="page-title">{{ $t('移动端报销审核') }}</h2>
      <div v-if="hasAuditPermission" class="audit-permission-info">
        审核金额上限: {{ userPrivilegeInfo.maxAmount }}
      </div>
    </header> -->

    <Tabs v-model:active-key="activeTab" class="mobile-tabs">
      <Tabs.TabPane key="audit" tab="审核列表">
        <div class="search-filters">
          <Form layout="vertical">
            <Row :gutter="16">
              <Col :span="24">
                <Form.Item :label="$t('page.park.item')">
                  <Select
                    v-model:value="searchForm.park"
                    :options="parkOptions"
                    :placeholder="$t('选择园区')"
                    allow-clear
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item :label="$t('用途')">
                  <Input
                    v-model:value="searchForm.purpose"
                    :placeholder="$t('搜索用途')"
                    allow-clear
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item :label="$t('状态')">
                  <Select
                    v-model:value="searchForm.status"
                    :options="statusOptions"
                    :placeholder="$t('选择状态')"
                    allow-clear
                  />
                </Form.Item>
              </Col>
            </Row>
            <div class="search-actions">
              <Button type="primary" @click="handleSearch" class="flex-1">
                <Search class="mr-1 h-4 w-4" />
                {{ $t('搜索') }}
              </Button>
              <Button @click="resetSearch" class="flex-1">
                {{ $t('重置') }}
              </Button>
            </div>
          </Form>
        </div>

        <Spin :spinning="loading" :tip="$t('加载中...')">
          <div v-if="reimbursementList.length > 0" class="audit-list">
            <Card
              v-for="item in reimbursementList"
              :key="item.id"
              class="audit-card"
              :body-style="{ padding: '0' }"
            >
              <div class="card-header">
                <span class="purpose-title">{{ item.purpose }}</span>
                <div class="card-tags">
                  <Tag
                    v-if="getAuditPriorityDisplay(item)"
                    :color="getAuditPriorityDisplay(item)?.color"
                  >
                    {{ getAuditPriorityDisplay(item)?.label }}
                  </Tag>
                  <Tag :color="getStatusDisplay(item.status).color">
                    {{ getStatusDisplay(item.status).text }}
                  </Tag>
                </div>
              </div>
              <div class="card-content">
                <div class="amount-display">
                  <span class="amount-label">报销金额</span>
                  <span class="amount">
                    ￥{{ Number(item.amount).toFixed(2) }}
                  </span>
                  <div
                    v-if="getAuditPriorityDisplay(item)"
                    class="priority-summary"
                    :class="getAuditPriorityDisplay(item)?.className"
                  >
                    {{ getAuditPriorityDisplay(item)?.reason }}
                  </div>
                </div>

                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">申请人</span>
                    <span class="info-value">{{ item.username }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">领款人</span>
                    <span class="info-value">{{ item.payee }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">申请日期</span>
                    <span class="info-value">
                      {{ formatDateTime(item.date) }}
                    </span>
                  </div>
                  <div v-if="item.status === 0" class="info-item">
                    <span class="info-label">待审时长</span>
                    <span class="info-value audit-age-value">
                      {{ formatAuditWaitingDays(item) }}
                    </span>
                  </div>
                  <div v-if="item.park" class="info-item">
                    <span class="info-label">园区</span>
                    <span class="info-value">{{ item.park }}</span>
                  </div>
                </div>

                <div
                  v-if="(item as any).remark || item.auditOpinion"
                  class="opinions-section"
                >
                  <p v-if="(item as any).remark" class="opinion-info">
                    <span class="opinion-label">申请备注:</span>
                    <span class="opinion-text">{{ (item as any).remark }}</span>
                  </p>
                  <p v-if="item.auditOpinion" class="opinion-info">
                    <!-- <span class="opinion-label"></span> -->
                    <span class="opinion-label">{{ item.auditOpinion }}</span>
                  </p>
                </div>

                <div
                  v-if="item.images && item.images.length > 0"
                  class="card-images"
                >
                  <button
                    type="button"
                    class="image-preview-button"
                    @click="handleRecordImagePreview(item)"
                  >
                    <img
                      :src="item.images[0]"
                      alt="报销凭证"
                      class="card-main-image"
                      loading="lazy"
                    />
                    <span
                      v-if="getRecordImageCount(item) > 1"
                      class="image-count"
                    >
                      共 {{ getRecordImageCount(item) }} 张
                    </span>
                  </button>
                </div>
              </div>
              <div class="card-actions">
                <Button
                  type="primary"
                  :disabled="
                    item.status === 0 && isAmountOverLimit(Number(item.amount))
                  "
                  block
                  @click="showAuditModal(item)"
                >
                  {{ item.status !== 0 ? $t('查看详情') : $t('审核') }}
                </Button>
              </div>
            </Card>
            <Pagination
              v-if="pagination.total > 0"
              :current="pagination.current"
              :page-size="pagination.pageSize"
              :total="pagination.total"
              @change="handlePageChange"
              size="small"
              class="list-pagination"
            />
          </div>
          <Empty
            v-else
            :description="loading ? $t('加载中...') : $t('暂无待审核记录')"
          />
        </Spin>
      </Tabs.TabPane>
      <Tabs.TabPane v-if="hasAuditPermission" key="analysis" tab="数据分析">
        <AnalysisPanel :park-options="parkOptions" />
      </Tabs.TabPane>
    </Tabs>

    <!-- 审核弹窗 -->
    <Modal
      v-model:open="isAuditModalVisible"
      :title="
        currentRecord && currentRecord.status > 0
          ? $t('报销审核详情')
          : $t('报销审核')
      "
      @ok="handleAuditSubmit(auditModalFormRef)"
      :confirm-loading="submitting"
      :mask-closable="false"
      :ok-text="
        currentRecord && currentRecord.status > 0 ? $t('关闭') : $t('确定')
      "
      wrap-class-name="mobile-audit-modal"
      :centered="true"
    >
      <div v-if="currentRecord" class="modal-content">
        <!-- Details Section -->
        <div class="modal-amount-display">
          <span class="modal-amount">
            ￥{{ Number(currentRecord.amount).toFixed(2) }}
          </span>
          <span class="modal-amount-label">报销金额</span>
        </div>

        <div class="modal-detail-grid">
          <div class="modal-info-item">
            <span class="modal-info-label">申请人</span>
            <span class="modal-info-value">{{ currentRecord.username }}</span>
          </div>
          <div class="modal-info-item">
            <span class="modal-info-label">领款人</span>
            <span class="modal-info-value">{{ currentRecord.payee }}</span>
          </div>
          <div class="modal-info-item">
            <span class="modal-info-label">所属园区</span>
            <span class="modal-info-value">{{ currentRecord.park }}</span>
          </div>
          <div class="modal-info-item">
            <span class="modal-info-label">申请日期</span>
            <span class="modal-info-value">
              {{ formatDateTime(currentRecord.date) }}
            </span>
          </div>
        </div>

        <div
          v-if="(currentRecord as any).auditorName"
          class="modal-detail-section"
        >
          <h4 class="modal-section-title">当前审核人</h4>
          <p class="modal-section-content">
            {{ (currentRecord as any).auditorName }}
          </p>
        </div>

        <div v-if="currentRecord.auditOpinion" class="modal-detail-section">
          <h4 class="modal-section-title">审核意见</h4>
          <p class="modal-section-content">{{ currentRecord.auditOpinion }}</p>
        </div>

        <div v-if="(currentRecord as any).remark" class="modal-detail-section">
          <h4 class="modal-section-title">申请备注</h4>
          <p class="modal-section-content">
            {{ (currentRecord as any).remark }}
          </p>
        </div>

        <div
          v-if="currentRecord.images && currentRecord.images.length > 0"
          class="modal-detail-section"
        >
          <h4 class="modal-section-title">相关图片</h4>
          <Carousel
            class="image-carousel-modal"
            :dots="currentRecord.images.length > 1"
            :infinite="false"
            :adaptive-height="true"
          >
            <Image
              v-for="(img, index) in currentRecord.images"
              :key="index"
              :src="img"
              :preview="false"
              class="carousel-detail-image"
              @click="handleImagePreview(currentRecord.images, index)"
            />
          </Carousel>
        </div>

        <!-- Warning -->
        <div
          v-if="
            currentRecord.status === 0 &&
            isAmountOverLimit(Number(currentRecord.amount))
          "
          class="permission-warning"
        >
          金额超出您的审核权限
        </div>

        <!-- Form -->
        <Form
          v-if="
            currentRecord.status === 0 &&
            !isAmountOverLimit(Number(currentRecord.amount))
          "
          ref="auditModalFormRef"
          :model="auditForm"
          :rules="rules"
          layout="vertical"
          class="audit-form-in-modal"
        >
          <div class="audit-form-section">
            <h4 class="modal-section-title">审核操作</h4>
            <Form.Item name="status" required>
              <Radio.Group
                v-model:value="auditForm.status"
                button-style="solid"
                class="audit-status-radio"
              >
                <Radio.Button
                  v-for="option in availableStatusOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="reason">
              <Input.TextArea
                v-model:value="auditForm.reason"
                :placeholder="$t('请输入审核意见 (选填，拒绝时建议填写)')"
                :maxlength="200"
                :auto-size="{ minRows: 3, maxRows: 5 }"
                show-count
              />
            </Form.Item>
          </div>
        </Form>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.mobile-audit-container {
  box-sizing: border-box;
  padding: 8px; /* Reduced padding for mobile */
  background-color: #f0f2f5;
}

.mobile-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}

.search-filters {
  padding: 12px 8px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.search-filters .ant-form-item {
  margin-bottom: 8px;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.audit-list {
  padding-bottom: 10px;
}

.audit-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

:deep(.audit-card .ant-card-body) {
  padding: 0;
}

.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.purpose-title {
  min-width: 0;
  margin-right: 8px; /* Add space between title and tag */
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word; /* Break long words if necessary */
  white-space: normal; /* Allow text to wrap */
}

.card-tags {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
  max-width: 148px;
}

.card-content {
  padding: 16px;
}

.amount-display {
  margin-bottom: 16px;
  text-align: center;
}

.amount-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #969799;
}

.amount {
  font-size: 24px;
  font-weight: 600;
  color: #fa541c;
}

.priority-summary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 2px 10px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
}

.priority-urgent {
  color: #cf1322;
  background: #fff1f0;
}

.priority-warning {
  color: #d46b08;
  background: #fff7e6;
}

.priority-normal {
  color: #0958d9;
  background: #e6f4ff;
}

.audit-age-value {
  font-weight: 600;
  color: #d46b08;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  margin-bottom: 2px;
  font-size: 13px;
  color: #969799;
}

.info-value {
  font-size: 14px;
  color: #323233;
}

.opinions-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.opinion-info {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #646566;
  background-color: #f7f8fa;
  border-radius: 6px;
}

.opinion-label {
  margin-right: 4px;
  font-weight: 600;
}

.opinion-text {
  word-break: break-all;
  white-space: pre-wrap;
}

.card-images {
  margin-top: 16px;
}

.image-preview-button {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  overflow: hidden;
  cursor: zoom-in;
  background: #f7f8fa;
  border: 0;
  border-radius: 6px;
}

.card-main-image {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: contain;
}

.image-count {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  font-size: 12px;
  line-height: 20px;
  color: #fff;
  background: rgb(0 0 0 / 55%);
  border-radius: 999px;
}

.card-actions {
  padding: 0 16px 16px;
}

.list-pagination {
  padding-bottom: 10px; /* Ensure space if content is scrollable */
  margin-top: 10px;
  text-align: center;
}

:deep(.mobile-audit-modal) {
  /* For .ant-modal-wrap */
  align-items: flex-start;
}

:deep(.mobile-audit-modal .ant-modal) {
  width: 100% !important;
  max-width: 100vw;
  padding: 0;
  margin: 0;
}

:deep(.mobile-audit-modal .ant-modal-content) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-radius: 0;
}

:deep(.mobile-audit-modal .ant-modal-header) {
  flex-shrink: 0;
}

:deep(.mobile-audit-modal .ant-modal-body) {
  flex: 1;
  max-height: none;
  padding: 16px 12px;
  overflow-y: auto;
}

:deep(.mobile-audit-modal .ant-modal-footer) {
  flex-shrink: 0;
}

.modal-content {
  font-size: 14px;
}

.modal-amount-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 5px;
  margin-bottom: 5px;
  text-align: center;
  border-bottom: 1px solid #f0f0f0;
}

.modal-amount {
  font-size: 28px;
  font-weight: 600;
  color: #1d2129;
}

.modal-amount-label {
  margin-top: 2px;
  font-size: 13px;
  color: #86909c;
}

.modal-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 10px;
}

.modal-info-item {
  display: flex;
  flex-direction: column;
}

.modal-info-label {
  margin-bottom: 4px;
  font-size: 13px;
  color: #86909c;
}

.modal-info-value {
  font-size: 14px;
  color: #1d2129;
}

.modal-detail-section {
  margin-bottom: 16px;
}

.modal-section-title {
  margin-bottom: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1d2129;
}

.modal-section-content {
  font-size: 14px;
  line-height: 1.6;
  color: #4e5969;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.permission-warning {
  padding: 8px;
  margin-bottom: 10px;
  font-size: 0.85em;
  color: #fa8c16;
  text-align: center;
  background-color: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
}

.audit-form-in-modal {
  margin-top: 16px;
}

.audit-form-section {
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}

.audit-form-in-modal .ant-form-item {
  margin-bottom: 12px;
}

.audit-status-radio {
  display: flex;
}

.audit-status-radio .ant-radio-button-wrapper {
  flex: 1;
  text-align: center;
}

:deep(.ant-empty-description) {
  color: #888;
}

.flex-1 {
  flex: 1;
}

.text-gray-600 {
  color: #4b5563;
}

.image-carousel {
  overflow: hidden;
  border-radius: 6px;
}

.carousel-main-image {
  width: 100%;
  height: auto;
  max-height: 40vh; /* 限制最大高度为视口的40% */
  cursor: zoom-in;
  object-fit: contain; /* 保证图片完整显示 */
}

:deep(.image-carousel .slick-dots-bottom) {
  bottom: 5px;
}

:deep(.image-carousel .slick-dots li button) {
  background: #fff;
  opacity: 0.5;
}

:deep(.image-carousel .slick-dots li.slick-active button) {
  background: #fff;
  opacity: 1;
}

.image-carousel-modal {
  margin-top: 4px;
  overflow: hidden;
  border-radius: 6px;
}

.carousel-detail-image {
  width: 100%;
  height: auto;
  max-height: 50vh; /* 弹窗中可以稍高一些 */
  cursor: zoom-in;
  object-fit: contain;
}

:deep(.image-carousel-modal .slick-dots-bottom) {
  bottom: 5px;
}

:deep(.image-carousel-modal .slick-dots li button) {
  background: #fff;
  opacity: 0.5;
}

:deep(.image-carousel-modal .slick-dots li.slick-active button) {
  background: #fff;
  opacity: 1;
}
</style>
