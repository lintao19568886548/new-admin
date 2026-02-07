<script lang="ts" setup>
// 从本地类型定义中导入 ReimbursementItem 类型

import { onMounted, ref } from 'vue';

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
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';
import { openMobileImagePreview } from '#/utils/mobile-image-preview';

import { STATUS_MAP, useFormRules } from './data';
import { statusOptions, useReimbursementAudit } from './modules/type';

// 使用组合式函数
const {
  auditForm,
  availableStatusOptions,
  currentRecord,
  fetchParkOptions,
  fetchReimbursements,
  handleAuditSubmit,
  handleSearch,
  isAmountOverLimit,
  isAuditModalVisible,
  loading,
  pagination,
  parkOptions,
  reimbursementList,
  resetSearch,
  searchForm,
  showAuditModal,
  submitting,
} = useReimbursementAudit();

// 表单相关 for the audit modal
const auditModalFormRef = ref();

// 表单验证规则
const rules = useFormRules();

// 组件挂载时初始化
onMounted(() => {
  fetchReimbursements();
  fetchParkOptions();
});

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

function handleImagePreview(images: string[] | undefined, index: number) {
  if (!images || images.length === 0) {
    return;
  }
  void openMobileImagePreview(images, index);
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
            <Tag :color="getStatusDisplay(item.status).color">
              {{ getStatusDisplay(item.status).text }}
            </Tag>
          </div>
          <div class="card-content">
            <div class="amount-display">
              <span class="amount-label">报销金额</span>
              <span class="amount">￥{{ Number(item.amount).toFixed(2) }}</span>
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
                <span class="info-value">{{ formatDateTime(item.date) }}</span>
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
              <Carousel
                class="image-carousel"
                :dots="item.images.length > 1"
                :infinite="false"
                :adaptive-height="true"
              >
                <Image
                  v-for="(img, index) in item.images"
                  :key="index"
                  :src="img"
                  :preview="false"
                  class="carousel-main-image"
                  @click="handleImagePreview(item.images, index)"
                />
              </Carousel>
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
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.purpose-title {
  margin-right: 8px; /* Add space between title and tag */
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word; /* Break long words if necessary */
  white-space: normal; /* Allow text to wrap */
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
