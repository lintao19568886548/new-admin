<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VisitorItem } from './types';

import { computed, onMounted, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';

import { PlusOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  message,
  Pagination,
  Row,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { deleteVisitor, getVisitorList } from '#/api/access/visitor';
import { getParkList as fetchParks } from '#/api/park';
import MobileDateRange from '#/components/MobileDateRange.vue';
import { $t } from '#/locales';

import { VISITOR_STATUS_OPTIONS, VISITOR_STATUS_TAGS } from './data';
import VisitorForm from './modules/form.vue';

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

// 访客列表数据
const visitorList = ref<VisitorItem[]>([]);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

/**
 * 清理和处理表单参数
 */
function processFormParams(formValues: Record<string, any>) {
  const params: Record<string, any> = {};
  Object.keys(formValues).forEach((key) => {
    if (
      formValues[key] !== undefined &&
      formValues[key] !== null &&
      formValues[key] !== ''
    ) {
      if (key === 'registerTime' && Array.isArray(formValues[key])) {
        const [start, end] = formValues[key] as [
          Dayjs | undefined,
          Dayjs | undefined,
        ];
        if (start && end) {
          params[key] =
            `${start.format('YYYY-MM-DD')},${end.format('YYYY-MM-DD')}`;
        }
      } else {
        params[key] = formValues[key];
      }
    }
  });
  return params;
}

const [VbenFormModal, formModalApi] = useVbenModal({
  connectedComponent: VisitorForm,
  destroyOnClose: true,
});

/**
 * 编辑访客记录
 */
function onEdit(row: VisitorItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建新访客记录
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除访客记录
 */
function onDelete(row: VisitorItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.visitorName]),
    duration: 0,
    key: 'action_process_msg',
  });

  deleteVisitor(row.visitorId)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.visitorName]),
        key: 'action_process_msg',
      });
      fetchList();
    })
    .catch((error) => {
      console.error('删除访客记录失败:', error);
      message.error({
        content: $t('ui.actionMessage.deleteFailed', [row.visitorName]),
        key: 'action_process_msg',
      });
    });
}

/**
 * 加载数据
 */
async function fetchList() {
  loading.value = true;
  try {
    const params = processFormParams(searchForm);
    params.currentPage = pagination.current;
    params.pageSize = pagination.pageSize;

    const result = await getVisitorList(params);
    visitorList.value = result.items || [];
    pagination.total = result.page?.total || result.total || 0;
  } catch (error) {
    console.error('获取访客列表失败:', error);
    message.error('获取访客列表失败');
    visitorList.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
}

/**
 * 搜索
 */
function onSearch() {
  pagination.current = 1;
  fetchList();
}

/**
 * 重置搜索
 */
function onReset() {
  searchForm.visitorName = '';
  searchForm.status = undefined;
  searchForm.registerTime = undefined;
  searchForm.parkId = undefined;
  onSearch();
}

/**
 * 刷新数据
 */

/**
 * 表单操作成功回调
 */
function onFormSuccess() {
  fetchList();
}

/**
 * 分页变化
 */
function onPageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchList();
}

/**
 * 获取状态标签配置
 */
function getStatusTag(status: number | string) {
  const tag = VISITOR_STATUS_TAGS.find((item) => item.value === status);
  return tag || { color: 'default', label: status };
}

/**
 * 格式化时间
 */
function formatTime(time: string) {
  if (!time) return '';
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
}

async function fetchParkOptions() {
  try {
    const parks = await fetchParks();
    parkOptions.value = parks.map((p: any) => ({
      label: p.parkName,
      value: p.parkId,
    }));
  } catch (error) {
    console.error('获取园区列表失败:', error);
  }
}

onMounted(() => {
  fetchList();
  fetchParkOptions();
});

const listIsEmpty = computed(
  () => !loading.value && visitorList.value.length === 0,
);
</script>

<template>
  <div class="visitor-mobile-page">
    <VbenFormModal @success="onFormSuccess" />

    <div class="search-filters">
      <Form layout="vertical" :model="searchForm">
        <Row :gutter="16">
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
            <Form.Item label="姓名">
              <Input
                v-model:value="searchForm.visitorName"
                placeholder="请输入姓名"
                allow-clear
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
        </Row>
        <div class="search-actions">
          <Button type="primary" @click="onSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('common.search') }}
          </Button>
          <Button @click="onReset" class="flex-1">
            {{ $t('common.reset') }}
          </Button>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('ui.loading')">
      <div v-if="visitorList.length > 0">
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
            <div class="mb-3 grid grid-cols-2 gap-4">
              <div v-if="item.parkName" class="info-item text-left">
                <span class="info-label">{{ $t('page.park.item') }}</span>
                <span class="info-value">{{ item.parkName }}</span>
              </div>
              <div
                class="info-item text-left"
                :class="{ 'col-span-2': !item.parkName }"
              >
                <span class="info-label">登记时间</span>
                <span class="info-value">{{
                  formatTime(item.registerTime)
                }}</span>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-4">
              <div v-if="item.phoneNumber" class="info-item text-left">
                <span class="info-label">手机号</span>
                <span class="info-value">{{ item.phoneNumber }}</span>
              </div>
              <div v-if="item.carNum" class="info-item text-left">
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
            <Button type="primary" danger ghost @click="onDelete(item)">
              {{ $t('common.delete') }}
            </Button>
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
        :description="$t('page.finance.noData')"
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
.visitor-mobile-page {
  box-sizing: border-box;
  padding: 8px;
  background-color: #f0f2f5;
}

.dark .visitor-mobile-page {
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
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.visitor-name {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
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
  font-size: 14px;
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

.card-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  width: 100%;
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.list-pagination {
  padding-bottom: 10px;
  margin-top: 10px;
  text-align: center;
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

/* 工具类 */
.w-full {
  width: 100%;
}
</style>
