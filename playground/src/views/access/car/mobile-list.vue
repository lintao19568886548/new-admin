<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { CarItem } from './types';

import { computed, onMounted, reactive, ref } from 'vue';

import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { FilterOutlined } from '@ant-design/icons-vue';
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
  Popconfirm,
  Row,
  Select,
  Spin,
  Tag,
  Textarea,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { createCar, deleteCar, getCarList, updateCar } from '#/api/access/car';
import { getParkList } from '#/api/park';
import MobileFloatingAction from '#/components/mobile/MobileFloatingAction.vue';
import MobileFormHeader from '#/components/mobile/MobileFormHeader.vue';
import MobilePage from '#/components/mobile/MobilePage.vue';
import MobilePagination from '#/components/mobile/MobilePagination.vue';
import MobilePanel from '#/components/mobile/MobilePanel.vue';
import MobileSubmitBar from '#/components/mobile/MobileSubmitBar.vue';
import MobileDateRange from '#/components/MobileDateRange.vue';

const statusOptions = [
  { label: '进入', value: 1 },
  { label: '离开', value: 0 },
];

const searchForm = reactive<{
  carNumber: string;
  parkId?: number;
  registerTime?: [Dayjs | undefined, Dayjs | undefined];
  status?: number;
}>({
  carNumber: '',
  parkId: undefined,
  registerTime: undefined,
  status: undefined,
});

const editForm = reactive<{
  carNumber: string;
  parkId?: number;
  registerTime: Dayjs;
  remark: string;
  status: number;
}>({
  carNumber: '',
  parkId: undefined,
  registerTime: dayjs(),
  remark: '',
  status: 1,
});

const carList = ref<CarItem[]>([]);
const currentRecord = ref<CarItem | null>(null);
const filterExpanded = ref(false);
const initialEditFormSnapshot = ref('');
const loading = ref(false);
const parkOptions = ref<{ label: string; value: number }[]>([]);
const saving = ref(false);
const viewMode = ref<'form' | 'list'>('list');
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const parkNameMap = computed(() => {
  return Object.fromEntries(
    parkOptions.value.map((item) => [item.value, item.label]),
  );
});

const pageTitle = computed(() =>
  currentRecord.value ? '编辑车辆出入' : '新增车辆出入',
);

const listIsEmpty = computed(
  () => !loading.value && carList.value.length === 0,
);

const hasAdvancedFilters = computed(() => {
  return (
    searchForm.parkId !== undefined ||
    searchForm.status !== undefined ||
    Boolean(searchForm.registerTime?.[0] && searchForm.registerTime?.[1])
  );
});

const hasUnsavedChanges = computed(() => {
  return (
    viewMode.value === 'form' &&
    initialEditFormSnapshot.value.length > 0 &&
    serializeEditForm() !== initialEditFormSnapshot.value
  );
});

function getResponseItems(response: any) {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }
  return [];
}

function getResponseTotal(response: any, fallback: number) {
  return Number(
    response?.page?.total ??
      response?.total ??
      response?.data?.page?.total ??
      response?.data?.total ??
      fallback,
  );
}

function getStatusTag(status: number | string | undefined) {
  const normalized = Number(status);
  if (normalized === 1) {
    return { color: 'success', label: '进入' };
  }
  if (normalized === 0) {
    return { color: 'processing', label: '离开' };
  }
  return { color: 'default', label: '-' };
}

function getParkName(item: CarItem) {
  const parkId = Number((item as any).parkId);
  return Number.isFinite(parkId) ? parkNameMap.value[parkId] || '-' : '-';
}

function formatTime(value?: string) {
  return value ? formatDateTime(value) : '-';
}

function serializeEditForm() {
  return JSON.stringify({
    carNumber: editForm.carNumber,
    parkId: editForm.parkId,
    registerTime: editForm.registerTime?.format('YYYY-MM-DD HH:mm:ss') || '',
    remark: editForm.remark,
    status: editForm.status,
  });
}

function buildQueryParams() {
  const [start, end] = searchForm.registerTime || [];
  return {
    carNumber: searchForm.carNumber,
    currentPage: pagination.current,
    currentPark: searchForm.parkId ?? -1,
    pageSize: pagination.pageSize,
    registerTime:
      start && end
        ? `${start.format('YYYY-MM-DD')},${end.format('YYYY-MM-DD')}`
        : undefined,
    status: searchForm.status,
  };
}

function resetEditForm(row?: CarItem) {
  editForm.carNumber = String(row?.carNumber || '');
  editForm.parkId = (row as any)?.parkId ?? searchForm.parkId;
  editForm.registerTime = row?.registerTime ? dayjs(row.registerTime) : dayjs();
  editForm.remark = String(row?.remark || '');
  editForm.status = Number(row?.status ?? 1);
  initialEditFormSnapshot.value = serializeEditForm();
}

async function fetchList() {
  loading.value = true;
  try {
    const response = await getCarList(buildQueryParams());
    const items = getResponseItems(response);
    carList.value = items;
    pagination.total = getResponseTotal(response, items.length);
  } catch (error) {
    console.error('获取车辆出入列表失败:', error);
    carList.value = [];
    pagination.total = 0;
    message.error('获取车辆出入列表失败');
  } finally {
    loading.value = false;
  }
}

async function fetchParkOptions() {
  try {
    const response = await getParkList();
    const parks = Array.isArray(response)
      ? response
      : (response as any)?.items || (response as any)?.data?.items || [];
    parkOptions.value = parks.map((park: any) => ({
      label: park.parkName,
      value: park.parkId,
    }));
    if (!editForm.parkId && parkOptions.value.length === 1) {
      editForm.parkId = parkOptions.value[0]?.value;
    }
  } catch (error) {
    console.error('获取园区列表失败:', error);
  }
}

function onSearch() {
  pagination.current = 1;
  filterExpanded.value = false;
  void fetchList();
}

function onReset() {
  searchForm.carNumber = '';
  searchForm.parkId = undefined;
  searchForm.registerTime = undefined;
  searchForm.status = undefined;
  onSearch();
}

function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  void fetchList();
}

function onCreate() {
  currentRecord.value = null;
  resetEditForm();
  viewMode.value = 'form';
}

function onEdit(row: CarItem) {
  currentRecord.value = row;
  resetEditForm(row);
  viewMode.value = 'form';
}

function backToList() {
  if (saving.value) return;
  if (hasUnsavedChanges.value) {
    Modal.confirm({
      cancelText: '继续编辑',
      content: '当前表单内容还没有保存，返回后本次修改不会保留。',
      okText: '放弃修改',
      onOk() {
        viewMode.value = 'list';
      },
      title: '确认返回？',
    });
    return;
  }
  viewMode.value = 'list';
}

function validateForm() {
  if (!editForm.carNumber.trim()) {
    message.warning('请输入车牌号');
    return false;
  }
  if (!editForm.parkId) {
    message.warning('请选择园区');
    return false;
  }
  if (!editForm.registerTime) {
    message.warning('请选择登记时间');
    return false;
  }
  return true;
}

async function onSave() {
  if (!validateForm()) return;

  const payload = {
    carNumber: editForm.carNumber.trim().toUpperCase(),
    parkId: editForm.parkId,
    registerTime: editForm.registerTime.format('YYYY-MM-DD HH:mm:ss'),
    remark: editForm.remark.trim(),
    status: editForm.status,
  };

  saving.value = true;
  try {
    if (currentRecord.value?.carId) {
      await updateCar(currentRecord.value.carId, payload);
      message.success('已更新车辆出入记录');
    } else {
      await createCar(payload);
      message.success('已新增车辆出入记录');
      pagination.current = 1;
    }
    viewMode.value = 'list';
    await fetchList();
  } catch (error) {
    console.error('保存车辆出入记录失败:', error);
    message.error('保存车辆出入记录失败');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: CarItem) {
  message.loading({
    content: `正在删除 ${row.carNumber}`,
    duration: 0,
    key: 'car_mobile_action',
  });

  try {
    await deleteCar(row.carId);
    message.success({
      content: `已删除 ${row.carNumber}`,
      key: 'car_mobile_action',
    });
    await fetchList();
  } catch (error) {
    console.error('删除车辆出入记录失败:', error);
    message.error({
      content: '删除车辆出入记录失败',
      key: 'car_mobile_action',
    });
  }
}

onMounted(() => {
  void fetchParkOptions();
  void fetchList();
});
</script>

<template>
  <MobilePage>
    <template v-if="viewMode === 'form'">
      <MobileFormHeader :title="pageTitle" @back="backToList" />

      <MobilePanel>
        <Form layout="vertical" :model="editForm">
          <Form.Item label="车牌号" required>
            <Input
              v-model:value="editForm.carNumber"
              allow-clear
              placeholder="请输入车牌号"
            />
          </Form.Item>
          <Form.Item label="园区" required>
            <Select
              v-model:value="editForm.parkId"
              :options="parkOptions"
              allow-clear
              placeholder="请选择园区"
            />
          </Form.Item>
          <Row :gutter="12">
            <Col :span="12">
              <Form.Item label="出入状态">
                <Select
                  v-model:value="editForm.status"
                  :options="statusOptions"
                  placeholder="请选择"
                />
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item label="登记时间" required>
                <DatePicker
                  v-model:value="editForm.registerTime"
                  class="w-full"
                  format="YYYY-MM-DD HH:mm"
                  show-time
                  input-read-only
                  placeholder="请选择"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注">
            <Textarea
              v-model:value="editForm.remark"
              placeholder="请输入备注"
              :rows="4"
              :maxlength="200"
              show-count
            />
          </Form.Item>
        </Form>
      </MobilePanel>

      <MobileSubmitBar
        :loading="saving"
        @cancel="backToList"
        @submit="onSave"
      />
    </template>

    <template v-else>
      <MobilePanel>
        <Form layout="vertical" :model="searchForm">
          <Row :gutter="8">
            <Col :span="24">
              <Form.Item label="车牌号">
                <Input
                  v-model:value="searchForm.carNumber"
                  allow-clear
                  placeholder="请输入车牌"
                />
              </Form.Item>
            </Col>
            <template v-if="filterExpanded">
              <Col :span="24">
                <Form.Item label="园区">
                  <Select
                    v-model:value="searchForm.parkId"
                    :options="parkOptions"
                    allow-clear
                    placeholder="请选择园区"
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item label="出入状态">
                  <Select
                    v-model:value="searchForm.status"
                    :options="statusOptions"
                    allow-clear
                    placeholder="请选择"
                  />
                </Form.Item>
              </Col>
              <Col :span="24">
                <Form.Item label="登记时间">
                  <MobileDateRange v-model:value="searchForm.registerTime" />
                </Form.Item>
              </Col>
            </template>
          </Row>

          <div class="search-actions">
            <Button
              class="filter-toggle-button"
              @click="filterExpanded = !filterExpanded"
            >
              <FilterOutlined />
              {{
                filterExpanded ? '收起' : hasAdvancedFilters ? '筛选中' : '筛选'
              }}
            </Button>
            <Button type="primary" class="flex-1" @click="onSearch">
              <Search class="mr-1 h-4 w-4" />
              搜索
            </Button>
            <Button class="flex-1" @click="onReset"> 重置 </Button>
          </div>
        </Form>
      </MobilePanel>

      <Spin :spinning="loading" tip="加载中...">
        <div v-if="carList.length > 0" class="car-list">
          <Card
            v-for="item in carList"
            :key="item.carId"
            class="car-card"
            :body-style="{ padding: '0' }"
          >
            <div class="card-header">
              <span class="car-number">{{ item.carNumber }}</span>
              <Tag :color="getStatusTag(item.status).color">
                {{ getStatusTag(item.status).label }}
              </Tag>
            </div>

            <div class="card-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">园区</span>
                  <span class="info-value">{{ getParkName(item) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">登记时间</span>
                  <span class="info-value">
                    {{ formatTime(item.registerTime) }}
                  </span>
                </div>
              </div>

              <div v-if="item.remark" class="remark-info">
                <span class="remark-label">备注:</span>
                <span class="remark-text">{{ item.remark }}</span>
              </div>
            </div>

            <div class="card-actions">
              <Button type="primary" ghost @click="onEdit(item)"> 编辑 </Button>
              <Popconfirm
                title="确认删除这条记录？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="onDelete(item)"
              >
                <Button type="primary" danger ghost>删除</Button>
              </Popconfirm>
            </div>
          </Card>

          <MobilePagination
            :current="pagination.current"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            @change="onPageChange"
          />
        </div>

        <Empty v-if="listIsEmpty" class="py-10" description="暂无数据" />
      </Spin>

      <MobileFloatingAction @click="onCreate" />
    </template>
  </MobilePage>
</template>

<style scoped>
.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.filter-toggle-button {
  min-width: 88px;
}

.filter-toggle-button :deep(.anticon) {
  margin-right: 4px;
}

.flex-1 {
  flex: 1;
}

.car-list {
  padding-bottom: 8px;
}

.car-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.car-number {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
}

.dark .car-number {
  color: #e5e7eb;
}

.card-content {
  padding: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
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
  min-width: 0;
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
  gap: 16px;
  justify-content: center;
  width: 100%;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
