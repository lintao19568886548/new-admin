<!-- eslint-disable no-empty-pattern -->
<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Spin,
  Table,
} from 'ant-design-vue';

import { $t } from '#/locales';

import { AUDITOR_LEVEL_MAP, useColumns, useFormRules } from './data';
import { statusOptions, useReimbursementAudit } from './modules';

// 获取用户信息
const userStore = useUserStore();
const userInfo = userStore.userInfo;

// 使用组合式函数
const {
  auditForm,
  availableStatusOptions,
  currentRecord,
  fetchReimbursements,
  handleAuditSubmit,
  handleDelete,
  handleSearch,
  handleTableChange,
  hasAuditPermission,
  isAuditModalVisible,
  loading,
  pagination,
  reimbursementList,
  resetSearch,
  searchForm,
  showAuditModal,
  submitting,
} = useReimbursementAudit();

// 表单相关
const formRef = ref(null);

// 表单验证规则
const rules = useFormRules();

// 预览图片相关
const previewVisible = ref(false);
const previewImage = ref('');
const previewTitle = ref('');

// 处理图片预览
function handleImagePreview(src: string, title: string = '预览图片') {
  previewImage.value = src;
  previewTitle.value = title;
  previewVisible.value = true;
}

// 组件挂载时初始化
onMounted(() => {
  // 获取报销列表数据
  fetchReimbursements();
});
</script>

<template>
  <Page>
    <Card :title="$t('报销审核')" class="mb-4">
      <!-- 搜索区域 -->
      <div class="mb-4 flex flex-wrap gap-2">
        <DatePicker.RangePicker
          v-model:value="searchForm.dateRange"
          placeholder="选择申请日期范围"
          class="w-64"
        />
        <Input
          v-model:value="searchForm.purpose"
          placeholder="搜索用途"
          class="w-48"
          allow-clear
        />
        <Input
          v-model:value="searchForm.username"
          placeholder="搜索申请人"
          class="w-48"
          allow-clear
          :disabled="!hasAuditPermission"
          :title="!hasAuditPermission ? '您只能查看自己的报销申请记录' : ''"
        />
        <Select
          v-model:value="searchForm.status"
          :options="statusOptions"
          placeholder="选择状态"
          class="w-32"
          allow-clear
        />
        <Button type="primary" @click="handleSearch">
          <Search class="mr-1 h-4 w-4" />
          搜索
        </Button>
        <Button @click="resetSearch">重置</Button>
      </div>

      <Spin :spinning="loading" tip="加载中...">
        <Table
          :columns="useColumns(showAuditModal)"
          :data-source="reimbursementList"
          row-key="id"
          :pagination="pagination"
          @change="handleTableChange"
          :scroll="{ x: 1300 }"
        >
          <template #emptyText>
            <Empty :description="loading ? '加载中...' : '暂无数据'" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <div class="flex justify-center gap-2">
                <Button
                  type="primary"
                  size="small"
                  @click="showAuditModal(record)"
                  :disabled="record.status !== 0"
                >
                  审核
                </Button>
                <Button
                  type="link"
                  danger
                  size="small"
                  @click="handleDelete(record)"
                  v-if="
                    hasAuditPermission ||
                    record.username ===
                      (userInfo?.realName || userInfo?.username)
                  "
                >
                  删除
                </Button>
              </div>
            </template>
          </template>
        </Table>
      </Spin>
    </Card>

    <!-- 审核弹窗 -->
    <Modal
      v-model:visible="isAuditModalVisible"
      :title="
        currentRecord && currentRecord.status > 0
          ? $t('报销审核详情')
          : $t('报销审核')
      "
      @ok="handleAuditSubmit(formRef)"
      :confirm-loading="submitting"
      :mask-closable="false"
      :ok-text="
        currentRecord && currentRecord.status > 0 ? $t('关闭') : $t('确定')
      "
      :cancel-button-props="{
        style: {
          display: currentRecord && currentRecord.status > 0 ? 'none' : '',
        },
      }"
    >
      <div v-if="currentRecord" class="p-4">
        <div class="mb-4 grid grid-cols-2 gap-4">
          <div>
            <p class="text-gray-500">申请人</p>
            <p>{{ currentRecord.username }}</p>
          </div>
          <div>
            <p class="text-gray-500">用途</p>
            <p>{{ currentRecord.purpose }}</p>
          </div>
          <div>
            <p class="text-gray-500">金额</p>
            <p class="text-lg font-bold text-red-500">
              ￥{{ Number(currentRecord.amount).toFixed(2) }}
            </p>
          </div>
          <div>
            <p class="text-gray-500">领款人</p>
            <p>{{ currentRecord.payee }}</p>
          </div>
          <div>
            <p class="text-gray-500">所属园区</p>
            <p>{{ currentRecord.park }}</p>
          </div>
          <div>
            <p class="text-gray-500">申请日期</p>
            <p>{{ currentRecord.date }}</p>
          </div>
          <div v-if="currentRecord.status > 0">
            <p class="text-gray-500">审核人</p>
            <p>
              {{
                currentRecord.auditorLevel
                  ? AUDITOR_LEVEL_MAP[currentRecord.auditorLevel] || '未知'
                  : '无'
              }}
            </p>
          </div>
        </div>

        <div v-if="currentRecord.remark" class="mb-4">
          <p class="text-gray-500">备注</p>
          <p>{{ currentRecord.remark }}</p>
        </div>

        <div v-if="currentRecord.reason" class="mb-4">
          <p class="text-gray-500">审核意见</p>
          <p>{{ currentRecord.reason }}</p>
        </div>

        <div
          v-if="currentRecord.images && currentRecord.images.length > 0"
          class="mb-4"
        >
          <p class="mb-2 text-gray-500">相关图片</p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(img, index) in currentRecord.images"
              :key="index"
              class="cursor-pointer"
              @click="handleImagePreview(img, `凭证图片 ${index + 1}`)"
            >
              <Image
                :src="img"
                alt="报销凭证"
                :width="80"
                :height="80"
                class="rounded object-cover"
              />
            </div>
          </div>
        </div>

        <!-- 仅在新审核时显示表单 -->
        <Form
          v-if="currentRecord.status === 0"
          :ref="(el) => (formRef = el)"
          :model="auditForm"
          :rules="rules"
          layout="vertical"
        >
          <Form.Item name="status" label="审核结果" required>
            <Select
              v-model:value="auditForm.status"
              placeholder="请选择审核结果"
              :options="availableStatusOptions"
            />
          </Form.Item>

          <Form.Item name="reason" label="审核意见">
            <Input.TextArea
              v-model:value="auditForm.reason"
              placeholder="请输入审核意见"
              :maxlength="200"
              :auto-size="{ minRows: 2, maxRows: 4 }"
              show-count
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>

    <!-- 图片预览 -->
    <Modal
      v-model:visible="previewVisible"
      :title="previewTitle"
      :footer="null"
    >
      <img alt="预览图片" style="width: 100%" :src="previewImage" />
    </Modal>
  </Page>
</template>

<style scoped>
.ant-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
