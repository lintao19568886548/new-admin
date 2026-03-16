<script lang="ts" setup>
import type { Elevator } from '#/api/maintenance';

import { computed, onMounted, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { formatDate, formatDateTime } from '@vben/utils';

import { PlusOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Row,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { deleteElevator, getElevatorList } from '#/api/maintenance';
import { getParkList as fetchParks } from '#/api/park';

import FormComponent from './modules/form.vue';

// 状态颜色映射
const STATUS_MAP: Record<string, { color: string; text: string }> = {
  异常: { color: 'red', text: '异常' },
  正常: { color: 'green', text: '正常' },
  维护: { color: 'blue', text: '维护' },
};

// Store and reactive data
const loading = ref(false);
const list = ref<Elevator[]>([]);

type ParkList = Awaited<ReturnType<typeof fetchParks>>;
type ParkItem = ParkList[number];

const parkOptions = ref<{ label: string; value: number }[]>([]);

// Pagination
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// Search form
const searchForm = reactive({
  checker: '',
  checkTime: [] as [] | [string, string],
  name: '',
  parkId: undefined,
  status: undefined,
});

// Modal
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: FormComponent,
  destroyOnClose: true,
});

// Methods
async function fetchData() {
  loading.value = true;
  try {
    const queryParams: Record<string, any> = { ...searchForm };

    if (queryParams.checkTime && queryParams.checkTime.length === 2) {
      queryParams.startTime = `${queryParams.checkTime[0]} 00:00:00`;
      queryParams.endTime = `${queryParams.checkTime[1]} 23:59:59`;
    }
    delete queryParams.checkTime;

    const params = {
      ...queryParams,
      currentPage: pagination.current,
      currentPark: queryParams.parkId ?? -1,
      limit: pagination.pageSize,
    };
    const result = await getElevatorList(params);
    list.value = result.items || [];
    pagination.total = result.total || 0;
  } catch (error) {
    console.error('Failed to fetch elevator list:', error);
    message.error('获取列表失败');
    list.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

async function fetchParkOptions() {
  try {
    const parks = await fetchParks();
    parkOptions.value = parks.map((park: ParkItem) => ({
      label: park.parkName,
      value: park.parkId,
    }));
  } catch (error) {
    console.error('获取园区列表失败', error);
  }
}

function handleSearch() {
  pagination.current = 1;
  fetchData();
}

function resetSearch() {
  searchForm.name = '';
  searchForm.status = undefined;
  searchForm.checker = '';
  searchForm.checkTime = [];
  searchForm.parkId = undefined;
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

function onEdit(record: Elevator) {
  formModalApi.setData(record).open();
}

function onDelete(record: Elevator) {
  Modal.confirm({
    content: `您确定要删除电梯 [${record.name}] 的维保记录吗?`,
    onOk: async () => {
      message.loading({ content: '删除中...', key: 'delete' });
      try {
        await deleteElevator(record.elevatorId);
        message.success({ content: '删除成功', key: 'delete' });
        fetchData();
      } catch (error) {
        console.error('Delete failed:', error);
        message.error({ content: '删除失败', key: 'delete' });
      }
    },
    title: '确认删除',
  });
}

// Computed
const listIsEmpty = computed(() => !loading.value && list.value.length === 0);

// Lifecycle
onMounted(() => {
  fetchData();
  fetchParkOptions();
});

function refreshList() {
  fetchData();
}
</script>

<template>
  <div class="elevator-mobile-page">
    <FormModal @success="refreshList" />

    <div class="search-filters">
      <Form layout="vertical" :model="searchForm">
        <Row :gutter="16">
          <Col :span="24">
            <Form.Item label="园区">
              <Select
                v-model:value="searchForm.parkId"
                :options="parkOptions"
                allow-clear
                placeholder="选择园区"
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="电梯名称">
              <Input
                v-model:value="searchForm.name"
                placeholder="搜索电梯名称"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="电梯状态">
              <Select
                v-model:value="searchForm.status"
                :options="
                  Object.values(STATUS_MAP).map((s) => ({
                    value: s.text,
                    label: s.text,
                  }))
                "
                placeholder="选择状态"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="检查人">
              <Input
                v-model:value="searchForm.checker"
                placeholder="搜索检查人"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item label="检查时间">
              <DatePicker.RangePicker
                v-model:value="
                  searchForm.checkTime as [string, string] | undefined
                "
                class="w-full"
                value-format="YYYY-MM-DD"
              />
            </Form.Item>
          </Col>
        </Row>
        <div class="search-actions">
          <Button type="primary" @click="handleSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            搜索
          </Button>
          <Button @click="resetSearch" class="flex-1"> 重置 </Button>
        </div>
      </Form>
    </div>
    <Spin :spinning="loading" tip="加载中...">
      <div v-if="list.length > 0">
        <Card
          v-for="item in list"
          :key="item.elevatorId"
          class="elevator-card"
          :body-style="{ padding: '0' }"
        >
          <div class="card-header">
            <span class="elevator-title">{{ item.name }}</span>
            <div class="header-tags">
              <Tag :color="STATUS_MAP[item.status]?.color || 'default'">
                {{ STATUS_MAP[item.status]?.text || item.status }}
              </Tag>
            </div>
          </div>
          <div class="card-content">
            <div class="mb-3 grid grid-cols-2 gap-4">
              <div class="info-item">
                <span class="info-label">厂房</span>
                <span class="info-value">{{ item.factory }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">承重</span>
                <span class="info-value">{{ item.loadCapacity }} 吨</span>
              </div>
              <div class="info-item">
                <span class="info-label">尺寸</span>
                <span class="info-value">
                  {{ item.size }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">检查人</span>
                <span class="info-value">{{ item.checker }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">检查时间</span>
                <span class="info-value">{{
                  formatDateTime(item.checkTime)
                }}</span>
              </div>
              <div v-if="item.productionDate" class="info-item">
                <span class="info-label">生产日期</span>
                <span class="info-value">{{
                  formatDate(item.productionDate)
                }}</span>
              </div>
            </div>
            <p v-if="item.remark" class="remark-info">
              <span class="remark-label">备注:</span>
              <span class="remark-text">{{ item.remark }}</span>
            </p>
          </div>
          <div class="card-actions">
            <Button type="primary" ghost @click="onEdit(item)"> 编辑 </Button>
            <Button type="primary" danger ghost @click="onDelete(item)">
              删除
            </Button>
          </div>
        </Card>

        <Pagination
          v-if="pagination.total > pagination.pageSize"
          v-model:current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="handlePageChange"
          size="small"
          class="list-pagination"
        />
      </div>
      <Empty v-if="listIsEmpty" class="py-10" description="暂无记录" />
    </Spin>
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
.elevator-mobile-page {
  box-sizing: border-box;
  padding: 8px;
  background-color: #f0f2f5;
}

.dark .elevator-mobile-page {
  background-color: #1a1a1a;
}

.search-filters {
  padding: 12px 8px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

.dark .search-filters {
  background-color: #2d2d2d;
}

.search-filters .ant-form-item {
  margin-bottom: 8px;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.flex-1 {
  flex: 1;
}

.elevator-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .elevator-card {
  background-color: #2d2d2d;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.dark .card-header {
  border-bottom-color: #424242;
}

.elevator-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
}

.dark .elevator-title {
  color: #f1f1f1;
}

.header-tags {
  display: flex;
  gap: 8px;
  align-items: center;
}

.card-content {
  padding: 16px;
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

.dark .info-label {
  color: #a0a0a0;
}

.info-value {
  font-size: 14px;
  color: #323233;
}

.dark .info-value {
  color: #e0e0e0;
}

.remark-info {
  padding: 10px 12px;
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #646566;
  background-color: #f7f8fa;
  border-radius: 6px;
}

.dark .remark-info {
  color: #c0c0c0;
  background-color: #3a3a3a;
}

.remark-label {
  margin-right: 4px;
  font-weight: 600;
}

.remark-text {
  word-break: break-all;
  white-space: pre-wrap;
}

.card-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.dark .card-actions {
  border-top-color: #424242;
}

.list-pagination {
  padding-bottom: 10px;
  margin-top: 10px;
  text-align: center;
}

/* Grid utilities */
.grid {
  display: grid;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.col-span-2 {
  grid-column: span 2 / span 2;
}

.gap-4 {
  gap: 1rem;
}

.mb-3 {
  margin-bottom: 0.75rem;
}

.py-10 {
  padding-top: 2.5rem;
  padding-bottom: 2.5rem;
}
</style>
