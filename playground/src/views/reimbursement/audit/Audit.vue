<!-- eslint-disable no-empty-pattern -->
<script lang="ts" setup>
import type {
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
  TablePaginationConfig,
} from 'ant-design-vue/es/table/interface';

import type { Park } from '#/components/AreaSelector.vue';

import { h, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
  Image,
  Input,
  message,
  Modal,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import { getVisitorParkList } from '#/api/park';
import {
  deleteReimbursement,
  getReimbursementList,
  updateReimbursement,
} from '#/api/reimbursement';
import { $t } from '#/locales';

// 定义类型
interface ReimbursementItem {
  amount: number;
  createTime?: string;
  date: string;
  department: string;
  id: number | string;
  images?: string[];
  park: string;
  payee: string;
  purpose: string;
  remark?: string;
  status: number;
  updateTime?: string;
  username?: string;
}

// 状态映射
const STATUS_MAP = {
  0: { color: 'warning', text: '待审核' },
  1: { color: 'success', text: '已通过' },
  2: { color: 'error', text: '已拒绝' },
};

// 部门选项
// const departmentOptions = [
//   { label: '技术部', value: 'tech' },
//   { label: '财务部', value: 'finance' },
//   { label: '人事部', value: 'hr' },
//   { label: '市场部', value: 'marketing' },
//   { label: '采购部', value: 'procure' },
//   { label: '工程部', value: 'engineering project  ' },
//   { label: '销售部', value: 'sales' },
//   { label: '客服部', value: 'customerService' },
// ];

// 园区列表
const parkList = ref<Park[]>([]);

// 获取园区列表
async function fetchParkList() {
  try {
    const result = await getVisitorParkList({ area: 'all' });
    parkList.value = result || [];
  } catch (error) {
    console.error('获取园区列表失败:', error);
    message.error('获取园区列表失败');
  }
}

// 状态选项
const statusOptions = [
  { label: '待审核', value: 0 },
  { label: '已通过', value: 1 },
  { label: '已拒绝', value: 2 },
];

// 表格数据
const tableData = ref<ReimbursementItem[]>([]);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 筛选条件
const filterForm = reactive<{
  dateRange: any[];
  department: string | undefined;
  parkId: number | undefined;
  purpose: string;
  status: number | undefined;
}>({
  dateRange: [],
  department: undefined,
  parkId: undefined,
  purpose: '',
  status: undefined,
});

// 审核对话框
const auditModalVisible = ref(false);
const currentRecord = ref<null | ReimbursementItem>(null);
const auditStatus = ref<number>(0);
const auditRemark = ref('');
const auditLoading = ref(false);

// 获取报销列表数据
async function fetchReimbursementList() {
  loading.value = true;
  try {
    // 构建查询参数
    // 在fetchReimbursementList方法中修改请求参数
    const params: Record<string, any> = {
      pageNo: pagination.current, // 原为 page: pagination.current
      pageSize: pagination.pageSize,
    };

    // 同时需要修改handleTableChange中的分页参数更新方式

    // 添加筛选条件
    if (filterForm.purpose) {
      params.purpose = filterForm.purpose;
    }
    if (filterForm.department) {
      params.department = filterForm.department;
    }
    if (filterForm.status !== undefined) {
      params.status = filterForm.status;
    }
    if (filterForm.dateRange && filterForm.dateRange.length === 2) {
      params.startDate = filterForm.dateRange[0]?.format('YYYY-MM-DD');
      params.endDate = filterForm.dateRange[1]?.format('YYYY-MM-DD');
    }

    if (filterForm.parkId) {
      params.parkId = filterForm.parkId;
    }

    const response = await getReimbursementList(params);
    tableData.value = response.items || [];
    pagination.total = response.total || 0;
  } catch (error) {
    console.error('获取报销列表失败:', error);
    message.error('获取报销列表失败');
  } finally {
    loading.value = false;
  }
}

// 表格变化处理
function handleTableChange(
  pag: TablePaginationConfig,
  _filters: Record<string, FilterValue | null>,
  _sorter: SorterResult<ReimbursementItem> | SorterResult<ReimbursementItem>[],
  {}: TableCurrentDataSource<ReimbursementItem>,
) {
  pagination.current = pag.current || 1;
  pagination.pageSize = pag.pageSize || 10;
  fetchReimbursementList();
}

// 重置筛选条件
function resetFilters() {
  filterForm.dateRange = [];
  filterForm.department = undefined;
  filterForm.parkId = undefined;
  filterForm.purpose = '';
  filterForm.status = undefined;
  pagination.current = 1;
  fetchReimbursementList();
}

// 搜索
function handleSearch() {
  pagination.current = 1;
  fetchReimbursementList();
}

// 打开审核对话框
function openAuditModal(record: ReimbursementItem) {
  currentRecord.value = record;
  auditStatus.value = record.status;
  auditRemark.value = record.remark || '';
  auditModalVisible.value = true;
}

// 提交审核
async function submitAudit() {
  if (!currentRecord.value) return;

  auditLoading.value = true;
  try {
    await updateReimbursement(Number(currentRecord.value.id), {
      remark: auditRemark.value,
      status: auditStatus.value,
    });

    message.success('审核操作成功');
    auditModalVisible.value = false;
    fetchReimbursementList();
  } catch (error) {
    console.error('审核操作失败:', error);
    message.error('审核操作失败');
  } finally {
    auditLoading.value = false;
  }
}

// 删除报销记录
async function handleDelete(record: ReimbursementItem) {
  Modal.confirm({
    cancelText: '取消',
    content: '确定要删除这条报销记录吗？',
    okText: '确定',
    async onOk() {
      try {
        await deleteReimbursement(Number(record.id));
        message.success('删除成功');
        fetchReimbursementList();
      } catch (error) {
        console.error('删除失败:', error);
        message.error('删除失败');
      }
    },
    title: '确认删除',
  });
}

// 初始化加载数据
onMounted(() => {
  fetchReimbursementList();
  fetchParkList();
});
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
          // { title: 'ID', dataIndex: 'id', width: 80, align: 'center' },
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
          // {
          //   title: '部门',
          //   dataIndex: 'department',
          //   customRender: ({ text }) => {
          //     const dept = departmentOptions.find((d) => d.value === text);
          //     return dept ? dept.label : text;
          //   },
          //   align: 'center'
          // },
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
              const status = STATUS_MAP[text as keyof typeof STATUS_MAP] || {
                color: 'default',
                text: '未知',
              };
              return h(Tag, { color: status.color }, () => status.text);
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
                    onClick: () => openAuditModal(record),
                  },
                  () => '审核',
                ),
                h(
                  Button,
                  {
                    type: 'link',
                    size: 'small',
                    danger: true,
                    onClick: () => handleDelete(record),
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
          <!-- <div>
            <div class="text-gray-500">部门</div>
            <div>
              {{
                departmentOptions.find(
                  (d) => d.value === currentRecord?.department,
                )?.label || currentRecord?.department
              }}
            </div>
          </div> -->
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
