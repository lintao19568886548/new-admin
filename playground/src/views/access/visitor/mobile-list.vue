<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VisitorItem } from './types';

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

import {
  createVisitor,
  deleteVisitor,
  getVisitorList,
  updateVisitor,
} from '#/api/access/visitor';
import { getParkList as fetchParks } from '#/api/park';
import MobileFloatingAction from '#/components/mobile/MobileFloatingAction.vue';
import MobileFormHeader from '#/components/mobile/MobileFormHeader.vue';
import MobilePage from '#/components/mobile/MobilePage.vue';
import MobilePagination from '#/components/mobile/MobilePagination.vue';
import MobilePanel from '#/components/mobile/MobilePanel.vue';
import MobileSubmitBar from '#/components/mobile/MobileSubmitBar.vue';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { $t } from '#/locales';

import {
  VISITOR_STATUS,
  VISITOR_STATUS_OPTIONS,
  VISITOR_STATUS_TAGS,
} from './data';

const parkOptions = ref<{ label: string; value: number }[]>([]);

const searchForm = reactive<{
  parkId?: number;
  registerTime?: [Dayjs | undefined, Dayjs | undefined];
  status?: number;
  visitorName: string;
}>({
  parkId: undefined,
  registerTime: undefined,
  status: undefined,
  visitorName: '',
});

const editForm = reactive<{
  carNum: string;
  parkId?: number;
  phoneNumber: string;
  registerTime: Dayjs;
  remark: string;
  status: number;
  visitorName: string;
}>({
  carNum: '',
  parkId: undefined,
  phoneNumber: '',
  registerTime: dayjs(),
  remark: '',
  status: VISITOR_STATUS.IN,
  visitorName: '',
});

const visitorList = ref<VisitorItem[]>([]);
const currentRecord = ref<null | VisitorItem>(null);
const filterExpanded = ref(false);
const initialEditFormSnapshot = ref('');
const loading = ref(false);
const saving = ref(false);
const viewMode = ref<'form' | 'list'>('list');
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const pageTitle = computed(() =>
  currentRecord.value ? '编辑访客记录' : '新增访客记录',
);

const listIsEmpty = computed(
  () => !loading.value && visitorList.value.length === 0,
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

function processFormParams(formValues: Record<string, any>) {
  const params: Record<string, any> = {};
  Object.keys(formValues).forEach((key) => {
    const value = formValues[key];
    if (value === undefined || value === null || value === '') return;

    if (key === 'registerTime' && Array.isArray(value)) {
      const [start, end] = value as [Dayjs | undefined, Dayjs | undefined];
      if (start && end) {
        params[key] = `${start.format('YYYY-MM-DD')},${end.format(
          'YYYY-MM-DD',
        )}`;
      }
      return;
    }

    params[key] = value;
  });
  return params;
}

function serializeEditForm() {
  return JSON.stringify({
    carNum: editForm.carNum,
    parkId: editForm.parkId,
    phoneNumber: editForm.phoneNumber,
    registerTime: editForm.registerTime?.format('YYYY-MM-DD HH:mm:ss') || '',
    remark: editForm.remark,
    status: editForm.status,
    visitorName: editForm.visitorName,
  });
}

function resetEditForm(row?: VisitorItem) {
  editForm.carNum = String(row?.carNum || '').toUpperCase();
  editForm.parkId = (row as any)?.parkId ?? searchForm.parkId;
  editForm.phoneNumber = String(row?.phoneNumber || '');
  editForm.registerTime = row?.registerTime ? dayjs(row.registerTime) : dayjs();
  editForm.remark = String(row?.remark || '');
  editForm.status = Number(row?.status ?? VISITOR_STATUS.IN);
  editForm.visitorName = String(row?.visitorName || '');
  initialEditFormSnapshot.value = serializeEditForm();
}

function getStatusTag(status: number | string) {
  const tag = VISITOR_STATUS_TAGS.find((item) => item.value === Number(status));
  return tag || { color: 'default', label: status };
}

function formatTime(time?: string) {
  return time ? formatDateTime(time) : '-';
}

async function fetchList() {
  loading.value = true;
  try {
    const params = processFormParams(searchForm);
    params.currentPage = pagination.current;
    params.pageSize = pagination.pageSize;

    const result = await getVisitorList(params);
    const items = getResponseItems(result);
    visitorList.value = items;
    pagination.total = getResponseTotal(result, items.length);
  } catch (error) {
    console.error('获取访客列表失败:', error);
    message.error('获取访客列表失败');
    visitorList.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

async function fetchParkOptions() {
  try {
    const parks = await fetchParks();
    parkOptions.value = parks.map((p: any) => ({
      label: p.parkName,
      value: p.parkId,
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
  searchForm.visitorName = '';
  searchForm.status = undefined;
  searchForm.registerTime = undefined;
  searchForm.parkId = undefined;
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

function onEdit(row: VisitorItem) {
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
  if (!editForm.visitorName.trim()) {
    message.warning('请输入访客姓名');
    return false;
  }
  if (!editForm.phoneNumber.trim()) {
    message.warning('请输入手机号');
    return false;
  }
  if (!/^1\d{10}$/.test(editForm.phoneNumber.trim())) {
    message.warning('请输入正确的手机号');
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
    carNum: editForm.carNum.trim().toUpperCase(),
    parkId: editForm.parkId,
    phoneNumber: editForm.phoneNumber.trim(),
    registerTime: editForm.registerTime.format('YYYY-MM-DD HH:mm:ss'),
    remark: editForm.remark.trim(),
    status: editForm.status,
    visitorName: editForm.visitorName.trim(),
  };

  saving.value = true;
  try {
    if (currentRecord.value?.visitorId) {
      await updateVisitor(currentRecord.value.visitorId, payload);
      message.success('已更新访客记录');
    } else {
      await createVisitor(payload);
      message.success('已新增访客记录');
      pagination.current = 1;
    }
    viewMode.value = 'list';
    await fetchList();
  } catch (error) {
    console.error('保存访客记录失败:', error);
    message.error('保存访客记录失败');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row: VisitorItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.visitorName]),
    duration: 0,
    key: 'visitor_mobile_action',
  });

  try {
    await deleteVisitor(row.visitorId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.visitorName]),
      key: 'visitor_mobile_action',
    });
    await fetchList();
  } catch (error) {
    console.error('删除访客记录失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [row.visitorName]),
      key: 'visitor_mobile_action',
    });
  }
}

onMounted(() => {
  void fetchList();
  void fetchParkOptions();
});
</script>

<template>
  <MobilePage>
    <template v-if="viewMode === 'form'">
      <MobileFormHeader :title="pageTitle" @back="backToList" />

      <MobilePanel>
        <Form layout="vertical" :model="editForm">
          <Form.Item label="姓名" required>
            <Input
              v-model:value="editForm.visitorName"
              allow-clear
              placeholder="请输入姓名"
            />
          </Form.Item>
          <Form.Item label="手机号" required>
            <Input
              v-model:value="editForm.phoneNumber"
              allow-clear
              inputmode="tel"
              placeholder="请输入手机号"
            />
          </Form.Item>
          <Form.Item :label="$t('page.park.item')" required>
            <Select
              v-model:value="editForm.parkId"
              :options="parkOptions"
              allow-clear
              :placeholder="$t('page.common.selectPark')"
            />
          </Form.Item>
          <Row :gutter="12">
            <Col :span="12">
              <Form.Item label="访问状态">
                <Select
                  v-model:value="editForm.status"
                  :options="VISITOR_STATUS_OPTIONS"
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
          <Form.Item label="车牌号">
            <Input
              v-model:value="editForm.carNum"
              allow-clear
              placeholder="请输入车牌号"
            />
          </Form.Item>
          <Form.Item label="来访原因">
            <Textarea
              v-model:value="editForm.remark"
              :maxlength="200"
              :rows="4"
              placeholder="请输入来访原因"
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
              <Form.Item label="姓名">
                <Input
                  v-model:value="searchForm.visitorName"
                  placeholder="请输入姓名"
                  allow-clear
                />
              </Form.Item>
            </Col>
            <template v-if="filterExpanded">
              <Col :span="24">
                <Form.Item :label="$t('page.park.item')">
                  <Select
                    v-model:value="searchForm.parkId"
                    :options="parkOptions"
                    allow-clear
                    :placeholder="$t('page.common.selectPark')"
                  />
                </Form.Item>
              </Col>
              <Col :span="12">
                <Form.Item label="访问状态">
                  <Select
                    v-model:value="searchForm.status"
                    :options="VISITOR_STATUS_OPTIONS"
                    allow-clear
                    placeholder="请选择状态"
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
              {{ $t('common.search') }}
            </Button>
            <Button class="flex-1" @click="onReset">
              {{ $t('common.reset') }}
            </Button>
          </div>
        </Form>
      </MobilePanel>

      <Spin :spinning="loading" :tip="$t('ui.loading')">
        <div v-if="visitorList.length > 0" class="visitor-list">
          <Card
            v-for="item in visitorList"
            :key="item.visitorId"
            class="visitor-card"
            :body-style="{ padding: '0' }"
          >
            <div class="card-header">
              <span class="visitor-name">{{ item.visitorName }}</span>
              <Tag :color="getStatusTag(item.status).color">
                {{ getStatusTag(item.status).label }}
              </Tag>
            </div>
            <div class="card-content">
              <div class="info-grid">
                <div v-if="item.parkName" class="info-item">
                  <span class="info-label">{{ $t('page.park.item') }}</span>
                  <span class="info-value">{{ item.parkName }}</span>
                </div>
                <div class="info-item" :class="{ 'span-all': !item.parkName }">
                  <span class="info-label">登记时间</span>
                  <span class="info-value">
                    {{ formatTime(item.registerTime) }}
                  </span>
                </div>
                <div v-if="item.phoneNumber" class="info-item">
                  <span class="info-label">手机号</span>
                  <span class="info-value">{{ item.phoneNumber }}</span>
                </div>
                <div v-if="item.carNum" class="info-item">
                  <span class="info-label">车牌号</span>
                  <span class="info-value">{{ item.carNum }}</span>
                </div>
              </div>
              <p v-if="item.remark" class="remark-info">
                <span class="remark-label">来访原因:</span>
                <span class="remark-text">{{ item.remark }}</span>
              </p>
            </div>
            <div class="card-actions">
              <Button type="primary" ghost @click="onEdit(item)">
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                title="确认删除这条记录？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="onDelete(item)"
              >
                <Button type="primary" danger ghost>
                  {{ $t('common.delete') }}
                </Button>
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

        <Empty
          v-if="listIsEmpty"
          class="py-10"
          :description="$t('page.finance.noData')"
        />
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

.visitor-list {
  padding-bottom: 8px;
}

.visitor-card {
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

.visitor-name {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
}

.dark .visitor-name {
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

.span-all {
  grid-column: 1 / -1;
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

.card-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  width: 100%;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
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
</style>
