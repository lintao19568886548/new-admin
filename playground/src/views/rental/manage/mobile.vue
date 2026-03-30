<!-- eslint-disable jsdoc/check-param-names -->
<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Form as AntForm,
  Button,
  Card,
  Col,
  Empty,
  Input,
  message,
  Pagination,
  Popconfirm,
  Row,
  Spin,
  Tag,
} from 'ant-design-vue';

import { deleteSystemPark, getSystemParkList } from '#/api/system/park';
import { $t } from '#/locales';
import { useParkStore } from '#/store';

import Form from './modules/form.vue';

const router = useRouter();
const parkStore = useParkStore();
const loading = ref(false);
const isMobileViewport = ref(false);

interface ParkItem {
  address?: string;
  area?: number | string;
  contact?: string;
  manager?: string;
  parkId: number;
  parkName: string;
}

const parkList = ref<ParkItem[]>([]);
const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
});

const formData = ref({
  address: '',
  parkName: '',
});

const listIsEmpty = computed(
  () => !loading.value && parkList.value.length === 0,
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function updateViewport() {
  isMobileViewport.value = window.innerWidth < 768;
}

function openEditor(row: null | ParkItem) {
  formModalApi
    .setState({
      class: isMobileViewport.value ? 'max-w-[100vw] w-[100vw]' : undefined,
      fullscreen: isMobileViewport.value,
    })
    .setData(row)
    .open();
}

/**
 * 编辑租赁项目
 * @param row
 */
function onEdit(row: ParkItem) {
  openEditor(row);
}

/**
 * 创建新租赁项目
 */
function onCreate() {
  openEditor(null);
}

/**
 * 删除租赁项目
 * @param row
 */
async function onDelete(row: Pick<ParkItem, 'parkId' | 'parkName'>) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.parkName]),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteSystemPark(row.parkId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.parkName]),
      key: 'action_process_msg',
    });

    void parkStore.fetchParkList(true);
    await fetchParkList();
  } catch (error) {
    console.error('删除租户失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [row.parkName]),
      key: 'action_process_msg',
    });
  }
}

/**
 * 查看租赁项目详情
 * @param row
 */
function onView(row: Pick<ParkItem, 'parkId'>) {
  router.push(`/rental/detail/${row.parkId}`);
}

function formatAreaDisplay(area?: number | string) {
  if (area === undefined || area === null) {
    return $t('page.park.mobile.areaFallback');
  }

  const value = typeof area === 'string' ? area.trim() : String(area);
  if (!value) {
    return $t('page.park.mobile.areaFallback');
  }

  return /m²|㎡/i.test(value) ? value : `${value} m²`;
}

/**
 * 获取园区列表数据
 */
async function fetchParkList() {
  loading.value = true;

  try {
    const initialParams = { ...formData.value };
    const apiParams: Record<string, any> = {};

    Object.keys(initialParams).forEach((key) => {
      const currentKey = key as keyof typeof initialParams;
      const value = initialParams[currentKey];

      if (value !== undefined && value !== null && value !== '') {
        apiParams[currentKey] = value;
      }
    });

    apiParams.currentPage = pagination.value.current;
    apiParams.pageSize = pagination.value.pageSize;

    const result = await getSystemParkList(apiParams);
    parkList.value = (result.items ?? []) as ParkItem[];
    pagination.value.total = result.total ?? result.page?.total ?? 0;
  } catch (error) {
    console.error('获取租赁列表失败:', error);
    message.error($t('ui.actionMessage.loadFailed', [$t('page.park.list')]));
    parkList.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

/**
 * 分页变化
 */
function onPageChange(page: number, pageSize: number) {
  pagination.value.current = page;
  pagination.value.pageSize = pageSize;
  void fetchParkList();
}

/**
 * 提交搜索表单
 */
function onSubmitSearch() {
  pagination.value.current = 1;
  void fetchParkList();
}

/**
 * 重置搜索表单
 */
function onResetSearch() {
  formData.value = {
    address: '',
    parkName: '',
  };
  pagination.value.current = 1;
  void fetchParkList();
}

/**
 * 表单操作成功回调
 */
function onFormSuccess() {
  pagination.value.current = 1;
  void parkStore.fetchParkList(true);
  void fetchParkList();
}

onMounted(() => {
  updateViewport();
  window.addEventListener('resize', updateViewport);
  void fetchParkList();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport);
});
</script>

<template>
  <div class="park-mobile-page">
    <FormModal @success="onFormSuccess" />

    <div class="search-filters">
      <AntForm layout="vertical">
        <Row :gutter="16">
          <Col :span="12">
            <AntForm.Item :label="$t('page.park.name')">
              <Input
                v-model:value="formData.parkName"
                allow-clear
                :placeholder="$t('page.park.mobile.searchParkNamePlaceholder')"
              />
            </AntForm.Item>
          </Col>
          <Col :span="12">
            <AntForm.Item :label="$t('page.park.address')">
              <Input
                v-model:value="formData.address"
                allow-clear
                :placeholder="$t('page.park.mobile.searchAddressPlaceholder')"
              />
            </AntForm.Item>
          </Col>
        </Row>
        <div class="search-actions">
          <Button type="primary" @click="onSubmitSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('common.search') }}
          </Button>
          <Button @click="onResetSearch" class="flex-1">
            {{ $t('common.reset') }}
          </Button>
        </div>
      </AntForm>
    </div>

    <Spin :spinning="loading" :tip="$t('ui.loading')">
      <div v-if="parkList.length > 0">
        <Card
          v-for="item in parkList"
          :key="item.parkId"
          class="park-card"
          :body-style="{ padding: '0' }"
        >
          <div class="card-header">
            <div class="card-header-main">
              <span class="park-name">{{ item.parkName }}</span>
              <span class="park-secondary">#{{ item.parkId }}</span>
            </div>
            <Tag color="blue">{{ formatAreaDisplay(item.area) }}</Tag>
          </div>

          <div class="card-content">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">{{ $t('page.park.manager') }}</span>
                <span class="info-value">
                  {{ item.manager || $t('page.park.mobile.noManager') }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">{{ $t('page.park.contact') }}</span>
                <span class="info-value">
                  {{ item.contact || $t('page.park.mobile.noContact') }}
                </span>
              </div>
            </div>
            <p class="remark-info">
              <span class="remark-label">{{ $t('page.park.address') }}:</span>
              <span class="remark-text">
                {{ item.address || $t('page.park.mobile.noAddress') }}
              </span>
            </p>
          </div>

          <div class="card-actions">
            <Button type="primary" ghost @click="onView(item)">
              <template #icon><EyeOutlined /></template>
              {{ $t('ui.action.view') }}
            </Button>
            <Button type="primary" ghost @click="onEdit(item)">
              <template #icon><EditOutlined /></template>
              {{ $t('ui.action.edit') }}
            </Button>
            <Popconfirm
              :title="$t('ui.actionMessage.deleteConfirm', [item.parkName])"
              @confirm="onDelete(item)"
              placement="top"
              :overlay-style="{ maxWidth: '250px' }"
            >
              <Button type="primary" danger ghost>
                <template #icon><DeleteOutlined /></template>
                {{ $t('ui.action.delete') }}
              </Button>
            </Popconfirm>
          </div>
        </Card>

        <Pagination
          v-if="pagination.total > pagination.pageSize"
          v-model:current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="onPageChange"
          size="small"
          class="list-pagination"
        />
      </div>
      <Empty
        v-if="listIsEmpty"
        class="py-10"
        :description="$t('page.park.mobile.empty')"
      />
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
.park-mobile-page {
  box-sizing: border-box;
  padding: 8px;
  background-color: #f0f2f5;
}

.dark .park-mobile-page {
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

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.flex-1 {
  flex: 1;
}

.park-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .park-card {
  background-color: #2d2d2d;
}

.card-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.dark .card-header {
  border-bottom-color: #3a3a3a;
}

.card-header-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.park-name {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
}

.dark .park-name {
  color: #e0e0e0;
}

.park-secondary {
  margin-top: 4px;
  font-size: 12px;
  color: #969799;
}

.card-content {
  padding: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.info-label {
  margin-bottom: 2px;
  font-size: 14px;
  color: #969799;
}

.dark .info-label {
  color: #a0a0a0;
}

.info-value {
  font-size: 14px;
  color: #323233;
  word-break: break-word;
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
  gap: 12px;
  justify-content: center;
  width: 100%;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.dark .card-actions {
  border-top-color: #3a3a3a;
}

.card-actions :deep(.ant-btn) {
  flex: 1;
}

.list-pagination {
  padding-bottom: 10px;
  margin-top: 10px;
  text-align: center;
}
</style>
