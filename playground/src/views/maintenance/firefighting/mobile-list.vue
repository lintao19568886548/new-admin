<script lang="ts" setup>
import type { Firefighting } from '#/api/maintenance';

import { onMounted, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

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

import { deleteFirefighting, getFirefightingList } from '#/api/maintenance';
import AreaSelector from '#/components/AreaSelector.vue';

import FormComponent from './modules/form.vue';

// 状态颜色映射
const STATUS_MAP: Record<string, { color: string; text: string }> = {
  异常: { color: 'red', text: '异常' },
  正常: { color: 'green', text: '正常' },
  维护: { color: 'blue', text: '维护' },
};

const STATUS_OPTIONS = Object.values(STATUS_MAP).map((s) => ({
  label: s.text,
  value: s.text,
}));

const activeKey = ref([]);

// Store and reactive data
// const userStore = useUserStore();
const loading = ref(false);
const list = ref<Firefighting[]>([]);
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
  extinguisher: undefined,
  fireExit: undefined,
  hydrant: undefined,
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
    const result = await getFirefightingList(params);
    list.value = result.items || [];
    pagination.total = result.total || 0;
  } catch (error) {
    console.error('Failed to fetch firefighting list:', error);
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
  searchForm.extinguisher = undefined;
  searchForm.hydrant = undefined;
  searchForm.fireExit = undefined;
  searchForm.checkTime = [];
  searchForm.checker = '';
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

function onEdit(record: Firefighting) {
  formModalApi.setData(record).open();
}

function onDelete(record: Firefighting) {
  Modal.confirm({
    content: `您确定要删除厂房 [${record.factory}] 的这条消防维保记录吗?`,
    onOk: async () => {
      message.loading({ content: '删除中...', key: 'delete' });
      try {
        await deleteFirefighting(record.firefightingId);
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
      <h2 class="page-title">消防维保记录</h2>
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
            <Form.Item label="灭火器检查">
              <Select
                v-model:value="searchForm.extinguisher"
                :options="STATUS_OPTIONS"
                placeholder="选择状态"
                allow-clear
              />
            </Form.Item>
            <Form.Item label="消防栓检查">
              <Select
                v-model:value="searchForm.hydrant"
                :options="STATUS_OPTIONS"
                placeholder="选择状态"
                allow-clear
              />
            </Form.Item>
            <Form.Item label="安全通道检查">
              <Select
                v-model:value="searchForm.fireExit"
                :options="STATUS_OPTIONS"
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
          <div
            v-for="item in list"
            :key="item.firefightingId"
            class="maint-card"
          >
            <div class="card-header">
              <span class="maint-item">{{ item.factory }}</span>
              <span class="checker">检查人: {{ item.checker }}</span>
            </div>
            <div class="card-body">
              <p>
                <strong>灭火器:</strong>
                <Tag :color="STATUS_MAP[item.extinguisher]?.color || 'default'">
                  {{ STATUS_MAP[item.extinguisher]?.text || item.extinguisher }}
                </Tag>
              </p>
              <p>
                <strong>消防栓:</strong>
                <Tag :color="STATUS_MAP[item.hydrant]?.color || 'default'">
                  {{ STATUS_MAP[item.hydrant]?.text || item.hydrant }}
                </Tag>
              </p>
              <p>
                <strong>安全通道:</strong>
                <Tag :color="STATUS_MAP[item.fireExit]?.color || 'default'">
                  {{ STATUS_MAP[item.fireExit]?.text || item.fireExit }}
                </Tag>
              </p>
              <p>
                <strong>检查时间:</strong> {{ formatDateTime(item.checkTime) }}
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

.checker {
  font-size: 0.9em;
  color: #888;
}

.card-body p {
  margin-bottom: 5px;
  line-height: 1.5;
}

.card-body p strong {
  display: inline-block;
  width: 70px; /* Align labels */
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
