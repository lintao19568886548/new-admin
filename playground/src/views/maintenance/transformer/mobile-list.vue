<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { TransformerItem } from '#/api/maintenance';

import { onMounted, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { PlusOutlined } from '@ant-design/icons-vue';
import {
  Button,
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

import { deleteTransformer, getTransformerList } from '#/api/maintenance';
import { getParkList as fetchParks } from '#/api/park';
import MobileDateRange from '#/components/MobileDateRange.vue';

import FormComponent from './modules/form.vue';

type TransformerRow = TransformerItem & { factoryName?: string; park?: string };

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

const loading = ref(false);
const list = ref<TransformerRow[]>([]);
const parkOptions = ref<{ label: string; value: number }[]>([]);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const searchForm = reactive<{
  checkTime?: [Dayjs | undefined, Dayjs | undefined];
  parkId?: number;
  specifications: string;
  status?: string;
}>({
  checkTime: undefined,
  parkId: undefined,
  specifications: '',
  status: undefined,
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: FormComponent,
  destroyOnClose: true,
});

function getParkName(record: TransformerRow) {
  const direct = String((record as any)?.park ?? '').trim();
  if (direct) return direct;

  const parkId = (record as any)?.parkId;
  if (parkId === undefined || parkId === null || parkId === '') return '';
  return parkOptions.value.find((p) => p.value === Number(parkId))?.label ?? '';
}

function processFormParams(values: Record<string, any>) {
  const params: Record<string, any> = {};

  params.currentPark = values.parkId === undefined ? -1 : Number(values.parkId);

  if (values.specifications) {
    params.specifications = String(values.specifications).trim();
  }

  if (values.status) {
    params.status = values.status;
  }

  if (
    Array.isArray(values.checkTime) &&
    values.checkTime.length === 2 &&
    values.checkTime[0] &&
    values.checkTime[1]
  ) {
    params.startTime = (values.checkTime[0] as Dayjs)
      .startOf('day')
      .toISOString();
    params.endTime = (values.checkTime[1] as Dayjs).endOf('day').toISOString();
  }

  return params;
}

async function fetchParkOptions() {
  try {
    const parks = await fetchParks();
    parkOptions.value = (parks || []).map((p: any) => ({
      label: p.parkName,
      value: Number(p.parkId),
    }));
  } catch (error) {
    console.error('获取园区列表失败:', error);
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const params = {
      ...processFormParams(searchForm),
      currentPage: pagination.current,
      pageSize: pagination.pageSize,
    };
    const result = await getTransformerList(params);
    list.value = result.items || [];
    pagination.total = result.total || 0;
  } catch (error) {
    console.error('Failed to fetch transformer list:', error);
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
  searchForm.parkId = undefined;
  searchForm.specifications = '';
  searchForm.status = undefined;
  searchForm.checkTime = undefined;
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

function onEdit(record: TransformerItem) {
  formModalApi.setData(record).open();
}

function onDelete(record: TransformerItem) {
  Modal.confirm({
    content: `您确定要删除厂房 [${(record as any).factoryName}] 的这条变压器维保记录吗?`,
    onOk: async () => {
      message.loading({ content: '删除中...', key: 'delete' });
      try {
        await deleteTransformer(record.transformerId);
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

onMounted(() => {
  fetchParkOptions();
  fetchData();
});
</script>

<template>
  <div class="mobile-maint-container">
    <FormModal @success="fetchData" />
    <div class="search-filters">
      <Form layout="vertical" :model="searchForm">
        <div>
          <Form.Item label="园区">
            <Select
              v-model:value="searchForm.parkId"
              :options="parkOptions"
              allow-clear
              placeholder="选择园区"
            />
          </Form.Item>
        </div>
        <div>
          <Form.Item label="规格">
            <Input
              v-model:value="searchForm.specifications"
              placeholder="搜索规格"
              allow-clear
            />
          </Form.Item>
        </div>
        <div>
          <Form.Item label="状态">
            <Select
              v-model:value="searchForm.status"
              :options="STATUS_OPTIONS"
              placeholder="选择状态"
              allow-clear
            />
          </Form.Item>
        </div>
        <div>
          <Form.Item label="检查时间">
            <MobileDateRange v-model:value="searchForm.checkTime" />
          </Form.Item>
        </div>
        <div class="search-actions">
          <Button type="primary" @click="handleSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            搜索
          </Button>
          <Button @click="resetSearch" class="flex-1">重置</Button>
        </div>
      </Form>
    </div>

    <div class="content-area">
      <Spin :spinning="loading" tip="加载中...">
        <div v-if="list.length > 0" class="maint-list">
          <div
            v-for="item in list"
            :key="item.transformerId"
            class="maint-card"
          >
            <div class="card-header">
              <span class="maint-item">{{ item.factoryName }}</span>
              <Tag :color="STATUS_MAP[item.status]?.color || 'default'">
                {{ STATUS_MAP[item.status]?.text || item.status }}
              </Tag>
            </div>
            <div class="card-body">
              <p v-if="getParkName(item)">
                <strong>园区:</strong> {{ getParkName(item) }}
              </p>
              <p><strong>规格:</strong> {{ item.specifications }}</p>
              <p><strong>检查人:</strong> {{ item.checker }}</p>
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
  font-size: 1.1em;
  font-weight: 400;
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
  width: 70px;
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
