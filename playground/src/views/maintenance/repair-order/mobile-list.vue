<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { RepairOrderWorkflowAction } from './workflow';

import type { RepairOrder } from '#/api/maintenance';

import { h, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { PlusOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Cascader,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getFactoryListByParkId } from '#/api/factory';
import {
  deleteRepairOrder,
  getRepairOrderList,
  updateRepairOrderWorkflow,
} from '#/api/maintenance';
import { getParkList as fetchParks } from '#/api/park';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { $t } from '#/locales';
import { getRepairOrderTodoPriorityInfo } from '#/utils/workbench-todo-priority';

import {
  REPAIR_PRIORITY_OPTIONS,
  REPAIR_STATUS_OPTIONS,
  REPAIR_TYPE_OPTIONS,
} from './data';
import FormComponent from './modules/form.vue';
import { getRepairOrderWorkflowActions } from './workflow';

type RepairOrderRow = RepairOrder & { factory?: string; park?: string };
type FactoryCascaderValue = Array<number | string>;

interface FactoryOption {
  children?: FactoryOption[];
  isLeaf?: boolean;
  label: string;
  value: number | string;
}

const PRIORITY_COLOR_MAP: Record<string, string> = {
  普通: 'default',
  紧急: 'red',
};

const STATUS_COLOR_MAP: Record<string, string> = {
  处理中: 'processing',
  已取消: 'default',
  已完成: 'success',
  待接单: 'warning',
  待验收: 'blue',
};

const loading = ref(false);
const list = ref<RepairOrderRow[]>([]);
const workflowLoadingIds = ref<number[]>([]);
const factoryOptions = ref<FactoryOption[]>([]);
const parkOptions = ref<{ label: string; value: number }[]>([]);
const route = useRoute();

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const searchForm = reactive<{
  createTimeRange?: [Dayjs | undefined, Dayjs | undefined];
  factoryId?: FactoryCascaderValue;
  orderNo: string;
  parkId?: number;
  priority?: string;
  repairType?: string;
  status?: string;
  tenantName: string;
  todoView?: string;
}>({
  createTimeRange: undefined,
  factoryId: undefined,
  orderNo: '',
  parkId: undefined,
  priority: undefined,
  repairType: undefined,
  status: undefined,
  tenantName: '',
  todoView: undefined,
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: FormComponent,
  destroyOnClose: true,
});

function getParkName(record: RepairOrderRow) {
  const direct = String(record.park || '').trim();
  if (direct) return direct;

  const parkId = record.parkId;
  if (parkId === undefined || parkId === null) return '';
  return parkOptions.value.find((p) => p.value === Number(parkId))?.label ?? '';
}

function getRepairTodoPriorityInfo(item: RepairOrderRow) {
  return getRepairOrderTodoPriorityInfo(item.priority, item.status);
}

function isWorkflowLoading(record: RepairOrderRow) {
  return workflowLoadingIds.value.includes(record.repairOrderId);
}

function getWorkflowButtonType(action: RepairOrderWorkflowAction) {
  return action === 'accept' || action === 'finish' || action === 'verify'
    ? 'primary'
    : 'default';
}

function isWorkflowDanger(action: RepairOrderWorkflowAction) {
  return action === 'cancel';
}

function processSearchParams(values: typeof searchForm) {
  const params: Record<string, any> = {
    currentPark: values.parkId === undefined ? -1 : Number(values.parkId),
  };

  if (values.orderNo) {
    params.orderNo = values.orderNo.trim();
  }
  if (values.tenantName) {
    params.tenantName = values.tenantName.trim();
  }
  if (values.repairType) {
    params.repairType = values.repairType;
  }
  if (values.status) {
    params.status = values.status;
  }
  if (values.priority) {
    params.priority = values.priority;
  }
  if (values.todoView) {
    params.todoView = values.todoView;
  }
  if (Array.isArray(values.factoryId) && values.factoryId.length > 0) {
    const selectedFactoryId = values.factoryId[values.factoryId.length - 1];
    if (selectedFactoryId !== undefined && selectedFactoryId !== '') {
      params.factoryId = Number(selectedFactoryId);
    }
  }
  if (Array.isArray(values.createTimeRange)) {
    const [startTime, endTime] = values.createTimeRange;
    if (startTime) {
      params.startTime = startTime.startOf('day').format('YYYY-MM-DD HH:mm:ss');
    }
    if (endTime) {
      params.endTime = endTime.endOf('day').format('YYYY-MM-DD HH:mm:ss');
    }
  }

  return params;
}

async function fetchFactoryOptions() {
  try {
    factoryOptions.value = (await getFactoryListByParkId()) || [];
  } catch (error) {
    console.error('获取厂房列表失败:', error);
  }
}

async function fetchParkOptions() {
  try {
    const parks = await fetchParks();
    parkOptions.value = (parks || []).map((park: any) => ({
      label: park.parkName,
      value: Number(park.parkId),
    }));
  } catch (error) {
    console.error('获取园区列表失败:', error);
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const result = await getRepairOrderList({
      ...processSearchParams(searchForm),
      currentPage: pagination.current,
      pageSize: pagination.pageSize,
    });
    list.value = result.items || [];
    pagination.total = result.total || 0;
  } catch (error) {
    console.error('获取报修工单列表失败:', error);
    message.error('获取报修工单列表失败');
    list.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.current = 1;
  fetchData();
}

function resetSearch() {
  searchForm.parkId = undefined;
  searchForm.factoryId = undefined;
  searchForm.orderNo = '';
  searchForm.tenantName = '';
  searchForm.repairType = undefined;
  searchForm.status = undefined;
  searchForm.priority = undefined;
  searchForm.createTimeRange = undefined;
  searchForm.todoView = undefined;
  handleSearch();
}

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchData();
}

function onCreate() {
  formModalApi.setData(null).open();
}

function onEdit(record: RepairOrderRow) {
  formModalApi.setData(record).open();
}

function onDelete(record: RepairOrderRow) {
  Modal.confirm({
    content: `确定删除工单 [${record.orderNo || record.repairOrderId}] 吗？`,
    onOk: async () => {
      message.loading({ content: '删除中...', key: 'repair-order-delete' });
      try {
        await deleteRepairOrder(record.repairOrderId);
        message.success({ content: '删除成功', key: 'repair-order-delete' });
        fetchData();
      } catch (error) {
        console.error('删除报修工单失败:', error);
        message.error({ content: '删除失败', key: 'repair-order-delete' });
      }
    },
    title: '确认删除',
  });
}

async function submitWorkflowAction(
  record: RepairOrderRow,
  action: RepairOrderWorkflowAction,
  remark?: string,
) {
  workflowLoadingIds.value = [
    ...workflowLoadingIds.value,
    record.repairOrderId,
  ];
  try {
    await updateRepairOrderWorkflow(record.repairOrderId, {
      action,
      remark,
    });
    message.success('工单状态已更新');
    await fetchData();
  } catch (error: any) {
    console.error('处理报修工单失败:', error);
    message.error(error?.message || '处理报修工单失败');
  } finally {
    workflowLoadingIds.value = workflowLoadingIds.value.filter(
      (id) => id !== record.repairOrderId,
    );
  }
}

function onWorkflowAction(
  record: RepairOrderRow,
  actionMeta: ReturnType<typeof getRepairOrderWorkflowActions>[number],
) {
  let remark = '';
  Modal.confirm({
    content: () =>
      h('div', { class: 'space-y-3' }, [
        h('p', actionMeta.content),
        actionMeta.placeholder
          ? h(Input.TextArea, {
              autoSize: { maxRows: 5, minRows: 3 },
              maxlength: 500,
              onChange: (event: Event) => {
                remark = (event.target as HTMLTextAreaElement).value;
              },
              placeholder: actionMeta.placeholder,
              showCount: true,
            })
          : null,
      ]),
    okText: actionMeta.okText,
    onOk: () => {
      const text = remark.trim();
      if (actionMeta.requireRemark && !text) {
        message.warning(actionMeta.placeholder || '请填写处理说明');
        return Promise.reject(new Error('REMARK_REQUIRED'));
      }
      return submitWorkflowAction(record, actionMeta.action, text);
    },
    title: actionMeta.title,
  });
}

function getRouteQueryText(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }

  return String(value || '').trim();
}

function applyRouteFilters() {
  const parkId = Number(route.query.parkId ?? route.query.currentPark);
  const orderNo = getRouteQueryText(route.query.orderNo);
  const status = getRouteQueryText(route.query.status);
  const tenantName = getRouteQueryText(route.query.tenantName);
  const todoView = getRouteQueryText(route.query.todoView);

  if (Number.isInteger(parkId) && parkId > 0) {
    searchForm.parkId = parkId;
  }
  if (orderNo) {
    searchForm.orderNo = orderNo;
  }
  if (status) {
    searchForm.status = status;
  }
  if (tenantName) {
    searchForm.tenantName = tenantName;
  }
  if (todoView) {
    searchForm.todoView = todoView;
  }
}

onMounted(() => {
  applyRouteFilters();
  fetchParkOptions();
  fetchFactoryOptions();
  fetchData();
});
</script>

<template>
  <div class="mobile-maint-container">
    <FormModal @success="fetchData" />

    <div class="search-filters">
      <Form layout="vertical" :model="searchForm">
        <div>
          <Form.Item :label="$t('page.park.item')">
            <Select
              v-model:value="searchForm.parkId"
              :options="parkOptions"
              allow-clear
              :placeholder="$t('page.common.selectPark')"
            />
          </Form.Item>
        </div>
        <div>
          <Form.Item label="厂房名称">
            <Cascader
              v-model:value="searchForm.factoryId"
              :options="factoryOptions"
              allow-clear
              placeholder="请选择园区和厂房"
            />
          </Form.Item>
        </div>
        <div>
          <Form.Item label="工单编号">
            <Input
              v-model:value="searchForm.orderNo"
              placeholder="搜索工单编号"
              allow-clear
            />
          </Form.Item>
        </div>
        <div>
          <Form.Item label="租户名称">
            <Input
              v-model:value="searchForm.tenantName"
              placeholder="搜索租户名称"
              allow-clear
            />
          </Form.Item>
        </div>
        <div>
          <Form.Item label="提交时间">
            <MobileDateRange v-model:value="searchForm.createTimeRange" />
          </Form.Item>
        </div>
        <div class="status-row">
          <Form.Item label="报修类型" class="status-item">
            <Select
              v-model:value="searchForm.repairType"
              :options="REPAIR_TYPE_OPTIONS"
              placeholder="类型"
              allow-clear
            />
          </Form.Item>
          <Form.Item label="工单状态" class="status-item">
            <Select
              v-model:value="searchForm.status"
              :options="REPAIR_STATUS_OPTIONS"
              placeholder="状态"
              allow-clear
            />
          </Form.Item>
          <Form.Item label="优先级" class="status-item">
            <Select
              v-model:value="searchForm.priority"
              :options="REPAIR_PRIORITY_OPTIONS"
              placeholder="优先级"
              allow-clear
            />
          </Form.Item>
        </div>
        <div class="search-actions">
          <Button type="primary" @click="handleSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('common.search') }}
          </Button>
          <Button @click="resetSearch" class="flex-1">
            {{ $t('common.reset') }}
          </Button>
        </div>
      </Form>
    </div>

    <div class="content-area">
      <Spin :spinning="loading" tip="加载中...">
        <div v-if="list.length > 0" class="maint-list">
          <div
            v-for="item in list"
            :key="item.repairOrderId"
            class="maint-card"
          >
            <div class="card-header">
              <span class="maint-item">
                {{ item.orderNo || `工单 #${item.repairOrderId}` }}
              </span>
              <div class="flex shrink-0 flex-wrap justify-end gap-1">
                <Tag
                  v-if="getRepairTodoPriorityInfo(item).visible"
                  class="mr-0"
                  :color="getRepairTodoPriorityInfo(item).color"
                >
                  {{ getRepairTodoPriorityInfo(item).label }}
                </Tag>
                <Tag
                  class="mr-0"
                  :color="STATUS_COLOR_MAP[item.status] || 'default'"
                >
                  {{ item.status }}
                </Tag>
              </div>
            </div>
            <div class="card-body">
              <p v-if="getParkName(item)">
                <strong>园区:</strong> {{ getParkName(item) }}
              </p>
              <p v-if="item.factory">
                <strong>厂房:</strong> {{ item.factory }}
              </p>
              <p v-if="item.tenantName">
                <strong>租户:</strong> {{ item.tenantName }}
              </p>
              <p v-if="item.tenantPhone">
                <strong>电话:</strong> {{ item.tenantPhone }}
              </p>
              <p v-if="item.source"><strong>来源:</strong> {{ item.source }}</p>
              <p>
                <strong>类型:</strong> {{ item.repairType }}
                <Tag
                  class="ml-1"
                  :color="PRIORITY_COLOR_MAP[item.priority] || 'default'"
                >
                  {{ item.priority }}
                </Tag>
              </p>
              <p v-if="getRepairTodoPriorityInfo(item).visible">
                <strong>提醒:</strong>
                {{ getRepairTodoPriorityInfo(item).reason }}
              </p>
              <p v-if="item.assignee">
                <strong>维修人:</strong> {{ item.assignee }}
              </p>
              <p>
                <strong>提交:</strong>
                {{ item.createTime ? formatDateTime(item.createTime) : '-' }}
              </p>
              <p><strong>描述:</strong> {{ item.description }}</p>
              <p v-if="item.processRemark">
                <strong>处理:</strong> {{ item.processRemark }}
              </p>
            </div>
            <div class="card-footer">
              <Button
                v-for="action in getRepairOrderWorkflowActions(item)"
                :key="action.action"
                :danger="isWorkflowDanger(action.action)"
                :loading="isWorkflowLoading(item)"
                :type="getWorkflowButtonType(action.action)"
                size="small"
                @click="onWorkflowAction(item, action)"
              >
                {{ action.text }}
              </Button>
              <Button type="primary" size="small" @click="onEdit(item)">
                编辑
              </Button>
              <Button
                type="primary"
                danger
                size="small"
                @click="onDelete(item)"
              >
                删除
              </Button>
            </div>
          </div>
          <Pagination
            v-if="pagination.total > pagination.pageSize"
            :current="pagination.current"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            @change="handlePageChange"
            size="small"
            class="list-pagination"
          />
        </div>
        <Empty v-else :description="loading ? '加载中...' : '暂无报修工单'" />
      </Spin>
    </div>

    <Teleport to="body">
      <div
        class="fixed bottom-[calc(1rem+env(safe-area-inset-bottom)+3.25rem)] right-4 z-[1000] flex flex-col gap-3"
      >
        <Button
          type="primary"
          shape="circle"
          size="large"
          @click="onCreate"
          class="!inline-flex !h-14 !w-14 items-center justify-center !p-0 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
        >
          <PlusOutlined class="text-xl" />
        </Button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.mobile-maint-container {
  display: flex;
  flex-direction: column;
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

.status-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.status-item {
  margin-bottom: 0;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.flex-1 {
  flex: 1;
}

.content-area {
  flex-grow: 1;
  padding: 8px;
  overflow-y: auto;
  background-color: #f0f2f5;
}

.maint-list {
  padding-bottom: 60px;
}

.maint-card {
  padding: 12px;
  margin-bottom: 8px;
  font-size: 14px;
  background-color: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.maint-item {
  min-width: 0;
  overflow: hidden;
  font-size: 1.1em;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body {
  font-size: 14px;
  color: #000000d9;
}

.card-body p {
  margin-bottom: 8px;
  line-height: 1.5;
}

.card-body p strong {
  display: inline-block;
  width: 56px;
  margin-right: 4px;
  font-weight: 400;
  color: inherit;
}

.card-footer {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
}

.list-pagination {
  padding: 16px 0;
  text-align: center;
}

:deep(.ant-empty-description) {
  color: #888;
}
</style>
