<!-- eslint-disable no-empty-pattern -->
<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

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
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import { STATUS_MAP, useColumns, useFormRules } from './data';
import {
  getUserPrivilegeInfo,
  statusOptions,
  useReimbursementAudit,
} from './modules/type';

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
  isAmountOverLimit,
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

// 添加用户权限等级信息计算属性
const userPrivilegeInfo = computed(() => {
  return getUserPrivilegeInfo(
    hasAuditPermission.value,
    userStore.userInfo?.rates,
  );
});

// 组件挂载时初始化
onMounted(() => {
  // 获取报销列表数据
  fetchReimbursements();
});
</script>

<template>
  <Page>
    <Card :title="$t('报销审核')" class="mb-4">
      <div class="mb-4 flex flex-col gap-4">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-lg font-semibold">报销审核</h2>
          <div v-if="hasAuditPermission" class="text-sm text-gray-600">
            审核权限：可审核金额 {{ userPrivilegeInfo.maxAmount }}
          </div>
        </div>

        <div class="flex flex-wrap gap-4 rounded-md bg-white p-4 shadow-sm">
          <DatePicker.RangePicker
            v-model:value="searchForm.dateRange"
            :placeholder="['开始日期', '结束日期']"
            value-format="YYYY-MM-DD"
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
                  @click="showAuditModal(record as any)"
                  :disabled="record.status !== 0"
                >
                  审核
                </Button>
                <Button
                  type="link"
                  danger
                  size="small"
                  @click="handleDelete(record as any)"
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
      :cancel-text="
        currentRecord && currentRecord.status > 0 ? null : $t('取消')
      "
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
              <span
                v-if="
                  currentRecord.status === 0 &&
                  isAmountOverLimit(Number(currentRecord.amount))
                "
                class="ml-2 text-xs text-red-500"
              >
                超出审核权限
              </span>
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
          <div v-if="(currentRecord as any).auditorName">
            <p class="text-gray-500">审核人</p>
            <p>
              {{ (currentRecord as any).auditorName }}
            </p>
          </div>
          <div v-if="currentRecord.status > 0">
            <p class="text-gray-500">审核结果</p>
            <p>
              <Tag
                :color="
                  STATUS_MAP[currentRecord.status as keyof typeof STATUS_MAP]
                    ?.color || 'default'
                "
              >
                {{
                  STATUS_MAP[currentRecord.status as keyof typeof STATUS_MAP]
                    ?.text || '未知'
                }}
              </Tag>
            </p>
          </div>
          <div v-if="(currentRecord as any).auditOpinion" class="col-span-2">
            <p class="text-gray-500">审核意见</p>
            <p>{{ (currentRecord as any).auditOpinion }}</p>
          </div>
          <div
            v-if="currentRecord.images && currentRecord.images.length > 0"
            class="col-span-2"
          >
            <p class="text-gray-500">相关图片</p>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(img, index) in currentRecord.images"
                :key="index"
                class="cursor-pointer"
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
        </div>
        <!-- 仅在新审核时显示表单 -->
        <Form
          v-if="currentRecord.status === 0"
          ref="formRef"
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
  </Page>
</template>

<style scoped>
.ant-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
