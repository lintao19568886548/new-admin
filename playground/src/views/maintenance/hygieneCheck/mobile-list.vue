<script lang="ts" setup>
import type { HygieneCheck } from '#/api/maintenance';

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

import { deleteHygieneCheck, getHygieneCheckList } from '#/api/maintenance';
import AreaSelector from '#/components/AreaSelector.vue';

import FormComponent from './modules/form.vue';

// 状态颜色映射
const STATUS_MAP: Record<string, { color: string; text: string }> = {
  不合格: { color: 'red', text: '不合格' },
  合格: { color: 'green', text: '合格' },
};

const STATUS_OPTIONS = Object.values(STATUS_MAP).map((s) => ({
  label: s.text,
  value: s.text,
}));

const activeKey = ref([]);

// Store and reactive data
const userStore = useUserStore();
const loading = ref(false);
const list = ref<HygieneCheck[]>([]);
const currentPark = ref<null | { parkId: string; parkName: string }>(null);

// Pagination
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// Search form
const searchForm = reactive({
  checkDate: [] as [] | [string, string],
  checker: '',
  checkItems: '',
  checkResult: undefined,
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

    if (queryParams.checkDate && queryParams.checkDate.length === 2) {
      queryParams.startTime = `${queryParams.checkDate[0]} 00:00:00`;
      queryParams.endTime = `${queryParams.checkDate[1]} 23:59:59`;
    }
    delete queryParams.checkDate;

    const params = {
      ...queryParams,
      currentPage: pagination.current,
      currentPark: currentPark.value?.parkId ?? -1,
      pageSize: pagination.pageSize,
    };
    const result = await getHygieneCheckList(params);
    list.value = result.items || [];
    pagination.total = result.page?.total || 0;
  } catch (error) {
    console.error('Failed to fetch hygiene check list:', error);
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
  searchForm.checkItems = '';
  searchForm.checkResult = undefined;
  searchForm.checker = '';
  searchForm.checkDate = [];
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

function onEdit(record: HygieneCheck) {
  formModalApi.setData(record).open();
}

function onDelete(record: HygieneCheck) {
  Modal.confirm({
    content: `您确定要删除厂房 [${record.factory}] 的这条卫生检查记录吗?`,
    onOk: async () => {
      message.loading({ content: '删除中...', key: 'delete' });
      try {
        await deleteHygieneCheck(record.hygieneCheckId);
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
      <h2 class="page-title">卫生检查记录</h2>
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
            <Form.Item label="检查项目">
              <Input
                v-model:value="searchForm.checkItems"
                placeholder="搜索检查项目"
                allow-clear
              />
            </Form.Item>
            <Form.Item label="检查结果">
              <Select
                v-model:value="searchForm.checkResult"
                :options="STATUS_OPTIONS"
                placeholder="选择结果"
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
            <Form.Item label="检查日期">
              <DatePicker.RangePicker
                v-model:value="
                  searchForm.checkDate as [string, string] | undefined
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
            :key="item.hygieneCheckId"
            class="maint-card"
          >
            <div class="card-header">
              <span class="maint-item">{{ item.factory }}</span>
              <Tag :color="STATUS_MAP[item.checkResult]?.color || 'default'">
                {{ STATUS_MAP[item.checkResult]?.text || item.checkResult }}
              </Tag>
            </div>
            <div class="card-body">
              <p><strong>检查项目:</strong> {{ item.checkItems }}</p>
              <p><strong>检查人:</strong> {{ item.checker }}</p>
              <p>
                <strong>检查日期:</strong> {{ formatDateTime(item.checkDate) }}
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
