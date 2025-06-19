<script lang="ts" setup>
import type { Elevator } from '#/api/maintenance';

import { onMounted, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';
import { formatDate, formatDateTime } from '@vben/utils';

import {
  Button,
  Collapse,
  DatePicker,
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

import { deleteElevator, getElevatorList } from '#/api/maintenance';
import AreaSelector from '#/components/AreaSelector.vue';

import FormComponent from './modules/form.vue';

// 状态颜色映射
const STATUS_MAP: Record<string, { color: string; text: string }> = {
  异常: { color: 'red', text: '异常' },
  正常: { color: 'green', text: '正常' },
  维护: { color: 'blue', text: '维护' },
};

const activeKey = ref([]);

// Store and reactive data
// const userStore = useUserStore();
const loading = ref(false);
const list = ref<Elevator[]>([]);
const currentPark = ref<null | { parkId: string; parkName: string }>(null);

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
      currentPark: currentPark.value?.parkId ?? -1,
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

function handleSearch() {
  pagination.current = 1;
  fetchData();
}

function resetSearch() {
  searchForm.name = '';
  searchForm.status = undefined;
  searchForm.checker = '';
  searchForm.checkTime = [];
  handleSearch();
}

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchData();
}

function handleAreaChange(park: any) {
  currentPark.value = park;
  handleSearch();
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

// Lifecycle
onMounted(() => {
  // if (userStore.userInfo?.parks?.[0]) {
  //   currentPark.value = userStore.userInfo.parks[0];
  // }
  fetchData();
});
</script>

<template>
  <div class="mobile-maint-container">
    <FormModal @success="fetchData" />
    <header class="page-header">
      <h2 class="page-title">电梯维保记录</h2>
      <AreaSelector
        :default-park="
          currentPark
            ? { ...currentPark, parkId: Number(currentPark.parkId) }
            : undefined
        "
        :refresh-callback="fetchData"
        @change="handleAreaChange"
      />
    </header>

    <Collapse v-model:active-key="activeKey" ghost>
      <Collapse.Panel key="1" header="搜索条件">
        <div class="search-filters">
          <Form layout="vertical">
            <Form.Item label="电梯名称">
              <Input
                v-model:value="searchForm.name"
                placeholder="搜索电梯名称"
                allow-clear
              />
            </Form.Item>
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
            <Form.Item label="检查人">
              <Input
                v-model:value="searchForm.checker"
                placeholder="搜索检查人"
                allow-clear
              />
            </Form.Item>
            <Form.Item label="检查时间">
              <DatePicker.RangePicker
                v-model:value="
                  searchForm.checkTime as [string, string] | undefined
                "
                class="w-full"
                value-format="YYYY-MM-DD"
              />
            </Form.Item>
            <div class="search-actions">
              <Button type="primary" @click="handleSearch" block>
                <Search class="mr-1 h-4 w-4" />
                搜索
              </Button>
              <Button @click="resetSearch" block style="margin-top: 8px">
                重置
              </Button>
            </div>
          </Form>
        </div>
      </Collapse.Panel>
    </Collapse>
    <div class="content-area">
      <Spin :spinning="loading" tip="加载中...">
        <div v-if="list.length > 0" class="maint-list">
          <div v-for="item in list" :key="item.elevatorId" class="maint-card">
            <div class="card-header">
              <span class="maint-item">{{ item.name }}</span>
              <Tag :color="STATUS_MAP[item.status]?.color || 'default'">
                {{ STATUS_MAP[item.status]?.text || item.status }}
              </Tag>
            </div>
            <div class="card-body">
              <p><strong>厂房:</strong> {{ item.factory }}</p>
              <p><strong>承重:</strong> {{ item.loadCapacity }} 吨</p>
              <p>
                <strong>尺寸:</strong> {{ item.sizeLength }}米 *
                {{ item.sizeWidth }}米 * {{ item.sizeHeight }}米
              </p>
              <p><strong>检查人:</strong> {{ item.checker }}</p>
              <p>
                <strong>检查时间:</strong> {{ formatDateTime(item.checkTime) }}
              </p>
              <p v-if="item.productionDate">
                <strong>生产日期:</strong> {{ formatDate(item.productionDate) }}
              </p>
              <p v-if="item.remark"><strong>备注:</strong> {{ item.remark }}</p>
            </div>
            <div class="card-footer">
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
        <Empty v-else :description="loading ? '加载中...' : '暂无记录'" />
      </Spin>
    </div>
    <div class="fab-container">
      <Button
        type="primary"
        shape="circle"
        @click="onCreate"
        class="fab-button"
      >
        <Plus class="size-6" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.mobile-maint-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: #f0f2f5;
}

.page-header {
  z-index: 10;
  padding: 10px 10px 0;
  background-color: #fff;
  box-shadow: 0 2px 8px #f0f1f2;
}

.page-title {
  margin: 0 0 8px;
  font-size: 1.2em;
  font-weight: bold;
  text-align: center;
}

.search-filters {
  padding: 12px;
  background-color: #fff;
}

.search-filters .ant-form-item {
  margin-bottom: 12px;
}

.content-area {
  flex-grow: 1;
  padding: 8px;
  overflow-y: auto;
  background-color: #f0f2f5;
}

.maint-list {
  padding-bottom: 60px; /* Space for FAB */
}

.maint-card {
  padding: 12px;
  margin-bottom: 8px;
  font-size: 0.9em;
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
  font-size: 1.1em;
  font-weight: bold;
}

.card-body p {
  margin-bottom: 5px;
  line-height: 1.5;
}

.card-body p strong {
  margin-right: 4px;
  color: #555;
}

.card-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.list-pagination {
  padding: 16px 0;
  text-align: center;
}

.fab-container {
  position: fixed;
  right: 16px;
  bottom: 24px;
  z-index: 100;
}

.fab-button {
  width: 50px;
  height: 50px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
}

:deep(.ant-empty-description) {
  color: #888;
}
</style>
