<!-- eslint-disable no-empty-pattern -->
<script lang="ts" setup>
import type { ReimbursementItem } from './composables/useReimbursementAudit';

import { h } from 'vue';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
  Image,
  Input,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { $t } from '#/locales';

import {
  STATUS_MAP,
  statusOptions,
  useReimbursementAudit,
} from './composables/useReimbursementAudit';

const {
  auditLoading,
  auditModalVisible,
  auditRemark,
  auditStatus,
  currentRecord,
  filterForm,
  handleDelete,
  handleSearch,
  handleTableChange,
  loading,
  openAuditModal,
  pagination,
  parkList,
  resetFilters,
  submitAudit,
  tableData,
} = useReimbursementAudit();

// departmentOptions is commented out in the original file, so it's removed here as well.
// If needed, it should be managed within the composable or imported separately.
</script>

<template>
  <Page>
    <Card :title="$t('报销审核')" class="mb-4">
      <!-- 筛选区域 -->
      <div class="mb-4 flex flex-wrap gap-4">
        <div class="flex items-center gap-2">
          <span>申请日期:</span>
          <DatePicker.RangePicker
            v-model:value="filterForm.dateRange as [string, string]"
            style="width: 240px"
          />
        </div>

        <div class="flex items-center gap-2">
          <span class="whitespace-nowrap">园区:</span>
          <Select
            v-model:value="filterForm.parkId"
            placeholder="请选择园区"
            style="width: 180px"
            allow-clear
          >
            <Select.Option
              v-for="park in parkList"
              :key="park.parkId"
              :value="park.parkId"
            >
              {{ park.parkName }}
            </Select.Option>
          </Select>
        </div>

        <div class="flex items-center gap-2">
          <span>用途:</span>
          <Input
            v-model:value="filterForm.purpose"
            placeholder="搜索用途"
            style="width: 150px"
            allow-clear
          />
        </div>

        <div class="flex items-center gap-2">
          <span>状态:</span>
          <Select
            v-model:value="filterForm.status"
            :options="statusOptions"
            placeholder="选择状态"
            style="width: 120px"
            allow-clear
          />
        </div>

        <div class="flex gap-2">
          <Button type="primary" @click="handleSearch">搜索</Button>
          <Button @click="resetFilters">重置</Button>
        </div>
      </div>

      <!-- 表格区域 -->
      <Table
        :columns="[
          {
            title: '用途',
            dataIndex: 'purpose',
            ellipsis: true,
            align: 'center',
          },
          {
            title: '金额(元)',
            dataIndex: 'amount',
            customRender: ({ text }) => `¥${Number(text).toFixed(2)}`,
            sorter: true,
            align: 'center',
          },
          { title: '领款人', dataIndex: 'payee', align: 'center' },
          { title: '所属园区', dataIndex: 'park', align: 'center' },
          {
            title: '申请日期',
            dataIndex: 'date',
            customRender: ({ text }) => formatDateTime(text),
            sorter: true,
            align: 'center',
          },
          { title: '申请人', dataIndex: 'username', align: 'center' },
          {
            title: '状态',
            dataIndex: 'status',
            customRender: ({ text }) => {
              const statusInfo = STATUS_MAP[
                text as keyof typeof STATUS_MAP
              ] || {
                color: 'default',
                text: '未知',
              };
              return h(Tag, { color: statusInfo.color }, () => statusInfo.text);
            },
            align: 'center',
          },
          {
            title: '操作',
            key: 'action',
            width: 120,
            align: 'center',
            customRender: ({ record }) => {
              return h('div', { class: 'flex gap-2 justify-center' }, [
                h(
                  Button,
                  {
                    type: 'primary',
                    size: 'small',
                    onClick: () => openAuditModal(record as ReimbursementItem),
                  },
                  () => '审核',
                ),
                h(
                  Button,
                  {
                    type: 'link',
                    size: 'small',
                    danger: true,
                    onClick: () => handleDelete(record as ReimbursementItem),
                  },
                  () => '删除',
                ),
              ]);
            },
          },
        ]"
        :data-source="tableData"
        :loading="loading"
        :pagination="{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }"
        row-key="id"
        @change="handleTableChange"
      />
    </Card>

    <!-- 审核对话框 -->
    <Modal
      v-model:visible="auditModalVisible"
      title="报销审核"
      :confirm-loading="auditLoading"
      @ok="submitAudit"
    >
      <div v-if="currentRecord" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="text-gray-500">用途</div>
            <div>{{ currentRecord?.purpose }}</div>
          </div>
          <div>
            <div class="text-gray-500">金额</div>
            <div>¥{{ Number(currentRecord?.amount).toFixed(2) }}</div>
          </div>
          <div>
            <div class="text-gray-500">领款人</div>
            <div>{{ currentRecord?.payee }}</div>
          </div>
          <div>
            <div class="text-gray-500">申请日期</div>
            <div>{{ formatDateTime(currentRecord?.date) }}</div>
          </div>
          <div>
            <div class="text-gray-500">申请人</div>
            <div>{{ currentRecord?.username }}</div>
          </div>

          <div>
            <div class="text-gray-500">所属园区</div>
            <div>{{ currentRecord?.park }}</div>
          </div>
          <div>
            <div class="mb-2 text-gray-500">相关图片</div>
            <div class="flex flex-wrap gap-2">
              <Image.PreviewGroup>
                <Image
                  v-for="item in currentRecord.images"
                  :key="item"
                  :src="item"
                  :width="80"
                  :height="80"
                  alt="报销凭证"
                  class="rounded object-cover"
                />
              </Image.PreviewGroup>
            </div>
            <div
              v-if="!currentRecord.images || currentRecord.images.length === 0"
            >
              无
            </div>
          </div>
        </div>

        <div>
          <div class="mb-2">审核状态</div>
          <Select
            v-model:value="auditStatus"
            :options="statusOptions"
            style="width: 100%"
          />
        </div>

        <div>
          <div class="mb-2">备注</div>
          <Input.TextArea
            v-model:value="auditRemark"
            placeholder="请输入审核备注"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            :maxlength="200"
            show-count
          />
        </div>
      </div>
    </Modal>
  </Page>
</template>
