<script lang="ts" setup>
import type { FactoryMaint } from '#/api/maintenance';

import { onMounted, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';
import { useUserStore } from '@vben/stores';
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

import { deleteFactoryMaint, getFactoryMaintList } from '#/api/maintenance';
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
const userStore = useUserStore();
const loading = ref(false);
const list = ref<FactoryMaint[]>([]);
const currentPark = ref<null | { parkId: string; parkName: string }>(null);

// Pagination
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// Search form
const searchForm = reactive({
  maintenanceItem: '',
  maintenancePeriod: [] as [] | [string, string],
  maintenanceStatus: undefined,
  personInCharge: '',
});

// Modal
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: FormComponent,
  destroyOnClose: true,
});

// Methods
async function fetchData() {
  if (!currentPark.value?.parkId) {
    list.value = [];
    pagination.total = 0;
    // 虽然没有园区ID，但仍可能需要获取所有数据，
    // 因此传递-1作为currentPark的值，与PC端行为保持一致。
  }
  loading.value = true;
  try {
    const queryParams: Record<string, any> = { ...searchForm };

    // Manual fieldMappingTime for date range
    if (
      queryParams.maintenancePeriod &&
      queryParams.maintenancePeriod.length === 2
    ) {
      queryParams.startTime = `${queryParams.maintenancePeriod[0]} 00:00:00`;
      queryParams.endTime = `${queryParams.maintenancePeriod[1]} 23:59:59`;
    }
    delete queryParams.maintenancePeriod;

    const params = {
      ...queryParams,
      currentPage: pagination.current,
      currentPark: currentPark.value?.parkId ?? -1,
      pageSize: pagination.pageSize,
    };
    const result = await getFactoryMaintList(params);
    list.value = result.items || [];
    pagination.total = result.page?.total || 0;
  } catch (error) {
    console.error('Failed to fetch maintenance list:', error);
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
  searchForm.maintenanceItem = '';
  searchForm.maintenanceStatus = undefined;
  searchForm.personInCharge = '';
  searchForm.maintenancePeriod = [];
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

function onEdit(record: FactoryMaint) {
  formModalApi.setData(record).open();
}

function onDelete(record: FactoryMaint) {
  Modal.confirm({
    content: `您确定要删除维护项目 [${record.maintenanceItem}] 吗?`,
    onOk: async () => {
      message.loading({ content: '删除中...', key: 'delete' });
      try {
        await deleteFactoryMaint(record.factoryMaintenanceId);
        message.success({ content: '删除成功', key: 'delete' });
        fetchData();
      } catch (error) {
        console.error('Delete failed:', error);
        message.error({ content: '删除失败', key: 'delete' });
      }
    },
    title: `确认删除`,
  });
}

// Lifecycle
onMounted(() => {
  if (userStore.userInfo?.parks?.[0]) {
    currentPark.value = userStore.userInfo.parks[0];
  }
  fetchData();
});
</script>

<template>
  <div class="mobile-maint-container">
    <FormModal @success="fetchData" />
    <header class="page-header">
      <h2 class="page-title">厂房维护记录</h2>
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
            <Form.Item label="维护项目">
              <Input
                v-model:value="searchForm.maintenanceItem"
                placeholder="搜索维护项目"
                allow-clear
              />
            </Form.Item>
            <Form.Item label="维护状态">
              <Select
                v-model:value="searchForm.maintenanceStatus"
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
            <Form.Item label="负责人">
              <Input
                v-model:value="searchForm.personInCharge"
                placeholder="搜索负责人"
                allow-clear
              />
            </Form.Item>
            <Form.Item label="维护时段">
              <DatePicker.RangePicker
                v-model:value="
                  searchForm.maintenancePeriod as [string, string] | undefined
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
            :key="item.factoryMaintenanceId"
            class="maint-card"
          >
            <div class="card-header">
              <span class="maint-item">{{ item.maintenanceItem }}</span>
              <Tag
                :color="STATUS_MAP[item.maintenanceStatus]?.color || 'default'"
              >
                {{
                  STATUS_MAP[item.maintenanceStatus]?.text ||
                  item.maintenanceStatus
                }}
              </Tag>
            </div>
            <div class="card-body">
              <p><strong>厂房:</strong> {{ item.factory }}</p>
              <p><strong>负责人:</strong> {{ item.personInCharge }}</p>
              <p>
                <strong>开始时间:</strong> {{ formatDateTime(item.startTime) }}
              </p>
              <p v-if="item.endTime">
                <strong>结束时间:</strong> {{ formatDateTime(item.endTime) }}
              </p>
              <p v-if="item.remark"><strong>备注:</strong> {{ item.remark }}</p>
            </div>
            <div class="card-footer">
              <Button type="primary" size="small" @click="onEdit(item)">
                编辑
              </Button>
              <Button danger size="small" @click="onDelete(item)">
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
