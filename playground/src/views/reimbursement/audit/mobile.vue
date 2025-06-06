<script lang="ts" setup>
import type { ReimbursementItem } from './modules/type';

import { computed, onMounted, ref, unref } from 'vue';

import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Empty,
  Form,
  Image,
  Input,
  message,
  Modal,
  Pagination, // Added for manual pagination control
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import {
  STATUS_MAP as AUDIT_STATUS_MAP,
  AUDITOR_LEVEL_MAP,
  useFormRules,
} from './data'; // Renamed STATUS_MAP to avoid conflict
import {
  statusOptions as auditStatusOptions, // Renamed for clarity
  getUserPrivilegeInfo,
  // Import type for clarity
  useReimbursementAudit,
} from './modules/type';

// 获取用户信息
// const userStore = useUserStore(); // Removed unused variable
// const userInfo = userStore.userInfo; // Removed unused variable

// 使用组合式函数
const {
  auditForm,
  availableStatusOptions,
  currentRecord,
  fetchReimbursements,
  handleAuditSubmit,
  // handleDelete, // Not implementing delete on mobile view for now to keep it simple
  handleSearch,
  // handleTableChange, // Will use custom pagination handler
  hasAuditPermission,
  isAuditModalVisible,
  loading,
  pagination, // pagination.current, pagination.pageSize, pagination.total
  reimbursementList,
  resetSearch,
  searchForm,
  showAuditModal, // This function will set currentRecord and show the modal
  submitting,
  userPrivilegeLevel,
} = useReimbursementAudit();

// 表单相关 for the audit modal
const auditModalFormRef = ref(); // Changed name to avoid conflict if a page form ref was needed

// 表单验证规则
const rules = useFormRules();

// 预览图片相关 (恢复)
const imagePreviewVisible = ref(false);
const imageToPreview = ref('');
const imagePreviewTitle = ref('');

// 处理图片预览 (恢复)
function handleImagePreview(src: string, title: string = '预览图片') {
  imageToPreview.value = src;
  imagePreviewTitle.value = title;
  imagePreviewVisible.value = true;
}

// 添加用户权限等级信息计算属性
const userPrivilegeInfo = computed(() => {
  return getUserPrivilegeInfo(unref(userPrivilegeLevel));
});

// 组件挂载时初始化
onMounted(() => {
  fetchReimbursements();
});

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchReimbursements();
}

// Function to get status text and color
function getStatusDisplay(status: number) {
  return (
    AUDIT_STATUS_MAP[status as keyof typeof AUDIT_STATUS_MAP] || {
      color: 'default',
      text: '未知',
    }
  );
}

// Check if audit button should be disabled
function isAuditDisabled(record: ReimbursementItem): boolean {
  if (record.status !== 0) return true; // Already audited

  // Check permission based on amount
  const amount = Number(record.amount);
  if (userPrivilegeLevel.value === 2 && amount > 10_000) return true; // Park manager limit
  if (userPrivilegeLevel.value === 3 && amount > 20_000) return true; // Director limit

  return false;
}

// Wrapper for showAuditModal to handle disabled state message
function triggerShowAuditModal(record: ReimbursementItem) {
  if (isAuditDisabled(record)) {
    if (record.status === 0) {
      message.warning('金额超出您的审核权限。');
    } else {
      message.info('该申请已审核。');
    }
    return;
  }
  showAuditModal(record);
}
</script>

<template>
  <div class="mobile-audit-container">
    <header class="page-header">
      <h2 class="page-title">{{ $t('移动端报销审核') }}</h2>
      <div v-if="hasAuditPermission" class="audit-permission-info">
        审核权限: {{ userPrivilegeInfo.text }} ({{
          userPrivilegeInfo.maxAmount
        }})
      </div>
    </header>

    <div class="search-filters">
      <Form layout="vertical">
        <Form.Item :label="$t('用途')">
          <Input
            v-model:value="searchForm.purpose"
            :placeholder="$t('搜索用途')"
            allow-clear
          />
        </Form.Item>
        <Form.Item v-if="hasAuditPermission" :label="$t('申请人')">
          <Input
            v-model:value="searchForm.username"
            :placeholder="$t('搜索申请人')"
            allow-clear
          />
        </Form.Item>
        <Form.Item :label="$t('状态')">
          <Select
            v-model:value="searchForm.status"
            :options="auditStatusOptions"
            :placeholder="$t('选择状态')"
            allow-clear
          />
        </Form.Item>
        <div class="search-actions">
          <Button type="primary" @click="handleSearch" block>
            <Search class="mr-1 h-4 w-4" />
            {{ $t('搜索') }}
          </Button>
          <Button @click="resetSearch" block style="margin-top: 8px">
            {{ $t('重置') }}
          </Button>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('加载中...')">
      <div v-if="reimbursementList.length > 0" class="audit-list">
        <div
          v-for="item in reimbursementList"
          :key="item.id"
          class="audit-card"
        >
          <div class="card-header">
            <span class="applicant">申请人: {{ item.username }}</span>
            <Tag :color="getStatusDisplay(item.status).color">
              {{ getStatusDisplay(item.status).text }}
            </Tag>
          </div>
          <div class="card-body">
            <p><strong>用途:</strong> {{ item.purpose }}</p>
            <p>
              <strong>金额:</strong>
              <span class="amount">￥{{ Number(item.amount).toFixed(2) }}</span>
            </p>
            <p><strong>领款人:</strong> {{ item.payee }}</p>
            <p><strong>园区:</strong> {{ item.park }}</p>
            <p><strong>申请日期:</strong> {{ formatDateTime(item.date) }}</p>
            <div
              v-if="item.images && item.images.length > 0"
              class="card-images"
            >
              <span class="images-label">凭证:</span>
              <Image.PreviewGroup>
                <Image
                  v-for="(img, index) in item.images"
                  :key="index"
                  :width="40"
                  :height="40"
                  :src="img"
                  class="thumbnail-image"
                  @click="handleImagePreview(img, `凭证 ${index + 1}`)"
                />
              </Image.PreviewGroup>
            </div>
          </div>
          <div class="card-footer">
            <Button
              type="primary"
              size="small"
              @click="triggerShowAuditModal(item)"
              :disabled="item.status !== 0 || isAuditDisabled(item)"
              block
            >
              {{ item.status !== 0 ? $t('查看详情') : $t('审核') }}
            </Button>
          </div>
        </div>
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
      v-model:visible="isAuditModalVisible"
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
    >
      <div v-if="currentRecord" class="modal-content">
        <div class="detail-grid">
          <p><strong>申请人:</strong> {{ currentRecord.username }}</p>
          <p><strong>用途:</strong> {{ currentRecord.purpose }}</p>
          <p>
            <strong>金额:</strong>
            <span class="amount">
              ￥{{ Number(currentRecord.amount).toFixed(2) }}
            </span>
          </p>
          <p><strong>领款人:</strong> {{ currentRecord.payee }}</p>
          <p><strong>所属园区:</strong> {{ currentRecord.park }}</p>
          <p>
            <strong>申请日期:</strong> {{ formatDateTime(currentRecord.date) }}
          </p>
          <div v-if="currentRecord.status > 0">
            <p>
              <strong>当前审核人:</strong>
              {{
                currentRecord.auditorLevel
                  ? AUDITOR_LEVEL_MAP[
                      currentRecord.auditorLevel as keyof typeof AUDITOR_LEVEL_MAP
                    ] || '未知'
                  : '无'
              }}
            </p>
          </div>

          <div v-if="currentRecord.remark" class="full-width-detail">
            <p><strong>备注:</strong> {{ currentRecord.remark }}</p>
          </div>

          <div
            v-if="currentRecord.remark && currentRecord.status !== 0"
            class="full-width-detail"
          >
            <p><strong>审核意见:</strong> {{ currentRecord.remark }}</p>
          </div>

          <div
            v-if="currentRecord.images && currentRecord.images.length > 0"
            class="full-width-detail"
          >
            <p><strong>相关图片:</strong></p>
            <div class="image-preview-list">
              <Image.PreviewGroup>
                <Image
                  v-for="(img, index) in currentRecord.images"
                  :key="index"
                  :width="60"
                  :height="60"
                  :src="img"
                  class="detail-image-item"
                  @click="handleImagePreview(img, `相关图片 ${index + 1}`)"
                />
              </Image.PreviewGroup>
            </div>
          </div>
        </div>

        <!-- 权限警告提示 -->
        <div
          v-if="
            currentRecord.status === 0 &&
            isAuditDisabled(currentRecord) &&
            !(
              (userPrivilegeLevel === 2 &&
                Number(currentRecord.amount) > 10000) ||
              (userPrivilegeLevel === 3 && Number(currentRecord.amount) > 20000)
            )
          "
          class="permission-warning"
        >
          金额超出您的审核权限
        </div>
        <div
          v-else-if="
            currentRecord.status === 0 &&
            ((userPrivilegeLevel === 2 &&
              Number(currentRecord.amount) > 10000) ||
              (userPrivilegeLevel === 3 &&
                Number(currentRecord.amount) > 20000))
          "
          class="permission-warning"
        >
          <span v-if="userPrivilegeLevel === 2">
            园区经理仅可审核10000元以下的申请。
          </span>
          <span v-else-if="userPrivilegeLevel === 3">
            总监仅可审核20000元以下的申请。
          </span>
        </div>

        <Form
          v-if="currentRecord.status === 0 && !isAuditDisabled(currentRecord)"
          ref="auditModalFormRef"
          :model="auditForm"
          :rules="rules"
          layout="vertical"
          class="audit-form-in-modal"
        >
          <Form.Item name="status" :label="$t('审核结果')" required>
            <Select
              v-model:value="auditForm.status"
              :placeholder="$t('请选择审核结果')"
              :options="availableStatusOptions"
            />
          </Form.Item>
          <Form.Item name="reason" :label="$t('审核意见')">
            <Input.TextArea
              v-model:value="auditForm.reason"
              :placeholder="$t('请输入审核意见 (选填，拒绝时建议填写)')"
              :maxlength="200"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              show-count
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>

    <!-- 单独的图片预览弹窗 (如果AntD的Image.PreviewGroup不够用或者样式冲突) -->
    <Modal
      :visible="imagePreviewVisible"
      :title="imagePreviewTitle"
      :footer="null"
      @cancel="imagePreviewVisible = false"
    >
      <img alt="预览图片" style="width: 100%" :src="imageToPreview" />
    </Modal>
  </div>
</template>

<style scoped>
.mobile-audit-container {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100vh; /* Full viewport height */
  padding: 8px; /* Reduced padding for mobile */
  overflow-y: auto; /* Allow scrolling for the whole page */
  background-color: #f0f2f5;
}

.page-header {
  padding: 10px 8px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.page-title {
  margin: 0 0 4px;
  font-size: 1.2em; /* Adjusted for mobile */
  font-weight: bold;
  text-align: center;
}

.audit-permission-info {
  font-size: 0.8em;
  color: #666;
  text-align: center;
}

.search-filters {
  padding: 12px 8px; /* Adjusted padding */
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.search-filters .ant-form-item {
  margin-bottom: 8px; /* Reduced margin */
}

.search-actions {
  margin-top: 8px;
}

.audit-list {
  flex-grow: 1; /* Takes remaining space */
  overflow-y: auto; /* Scroll for list if content overflows */
}

.audit-card {
  padding: 10px;
  margin-bottom: 8px;
  font-size: 0.9em;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.applicant {
  font-weight: bold;
}

.amount {
  font-weight: bold;
  color: #fa541c;
}

.card-body p {
  margin-bottom: 4px;
  line-height: 1.4;
}

.card-images {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 4px;
}

.images-label {
  margin-right: 4px;
  font-weight: bold;
}

.thumbnail-image {
  object-fit: cover;
  border-radius: 3px;
}

.card-footer {
  margin-top: 10px;
}

.list-pagination {
  padding-bottom: 10px; /* Ensure space if content is scrollable */
  margin-top: 10px;
  text-align: center;
}

:deep(.mobile-audit-modal .ant-modal-body) {
  max-height: 70vh;
  padding: 12px; /* Reduced padding for modal body */
  overflow-y: auto;
}

.modal-content .detail-grid {
  display: grid;
  grid-template-columns: 1fr; /* Single column for mobile */
  gap: 8px; /* Gap between items */
  margin-bottom: 12px;
  font-size: 0.9em;
}

.modal-content .detail-grid p {
  margin-bottom: 2px;
}

.full-width-detail {
  grid-column: 1 / -1; /* Span full width if needed */
}

.image-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.detail-image-item {
  object-fit: cover;
  border-radius: 4px;
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

.audit-form-in-modal .ant-form-item {
  margin-bottom: 10px;
}

/* Ensure Empty component description is visible */
:deep(.ant-empty-description) {
  color: #888;
}
</style>
