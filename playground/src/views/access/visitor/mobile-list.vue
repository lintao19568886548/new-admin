<script lang="ts" setup>
import type { VisitorItem } from './types';

import { computed, onMounted, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  message,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { deleteVisitor, getVisitorList } from '#/api/access/visitor';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { VISITOR_STATUS_OPTIONS, VISITOR_STATUS_TAGS } from './data';
import Form from './modules/form.vue';

// 当前选中的区域
const currentPark = ref();

// 搜索表单数据
const searchForm = ref({
  carNum: '',
  phoneNumber: '',
  registerTime: undefined,
  status: undefined,
  visitorName: '',
});

// 访客列表数据
const visitorList = ref<VisitorItem[]>([]);
const loading = ref(false);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

// 是否显示搜索表单
const showSearchForm = ref(false);

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
      // 处理状态值，将字符串转换为数字
      if (key === 'status') {
        if (formValues[key] === '进入') {
          params[key] = 0;
        } else if (formValues[key] === '离开') {
          params[key] = 1;
        } else {
          params[key] = formValues[key];
        }
      }
      // 处理日期范围，将数组转换为逗号分隔的字符串
      else if (key === 'registerTime' && Array.isArray(formValues[key])) {
        params[key] = formValues[key].join(',');
      } else {
        params[key] = formValues[key];
      }
    }
  });
  return params;
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
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
      loadData();
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
 * 查看访客记录详情
 */
function onView(row: VisitorItem) {
  formModalApi.setData({ ...row, readonly: true }).open();
}

/**
 * 加载数据
 */
async function loadData() {
  loading.value = true;
  try {
    const params = processFormParams(searchForm.value);
    params.currentPark = currentPark.value ? currentPark.value.parkId : -1;
    params.currentPage = currentPage.value;
    params.pageSize = pageSize.value;

    const result = await getVisitorList(params);
    visitorList.value = result.items || [];
    total.value = result.page?.total || 0;
  } catch (error) {
    console.error('获取访客列表失败:', error);
    message.error('获取访客列表失败');
    visitorList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

/**
 * 搜索
 */
function onSearch() {
  currentPage.value = 1;
  loadData();
}

/**
 * 重置搜索
 */
function onReset() {
  searchForm.value = {
    carNum: '',
    phoneNumber: '',
    registerTime: undefined,
    status: undefined,
    visitorName: '',
  };
  currentPage.value = 1;
  loadData();
}

/**
 * 刷新数据
 */
function onRefresh() {
  loadData();
}

/**
 * 表单操作成功回调
 */
function onFormSuccess() {
  loadData();
}

/**
 * 分页变化
 */
function onPageChange(page: number) {
  currentPage.value = page;
  loadData();
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

// 监听园区选择变化，自动刷新数据
watch(
  () => currentPark.value,
  () => {
    currentPage.value = 1;
    loadData();
  },
);

// 组件挂载时加载数据
onMounted(() => {
  loadData();
});

// 计算分页信息
const paginationInfo = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value + 1;
  const end = Math.min(currentPage.value * pageSize.value, total.value);
  return `${start}-${end} / ${total.value}`;
});

// 计算是否有上一页/下一页
const hasPrev = computed(() => currentPage.value > 1);
const hasNext = computed(
  () => currentPage.value * pageSize.value < total.value,
);
</script>

<template>
  <Page class="mobile-visitor-list">
    <FormModal @success="onFormSuccess" />

    <!-- 头部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="onRefresh"
          @change="(park) => (currentPark = park)"
          class="area-selector"
        />
      </div>
      <div class="toolbar-right">
        <Button
          type="text"
          @click="showSearchForm = !showSearchForm"
          class="search-btn"
        >
          <Search class="icon" />
        </Button>
        <Button type="text" @click="onRefresh" class="refresh-btn">
          <Refresh class="icon" />
        </Button>
        <Button type="primary" @click="onCreate" class="add-btn">
          <Plus class="icon" />
        </Button>
      </div>
    </div>

    <!-- 搜索表单 -->
    <Card v-if="showSearchForm" class="search-form">
      <div class="form-grid">
        <div class="form-item">
          <label>姓名</label>
          <Input
            v-model:value="searchForm.visitorName"
            placeholder="请输入姓名"
          />
        </div>
        <div class="form-item">
          <label>手机号</label>
          <Input
            v-model:value="searchForm.phoneNumber"
            placeholder="请输入手机号"
          />
        </div>
        <div class="form-item">
          <label>车牌号</label>
          <Input v-model:value="searchForm.carNum" placeholder="请输入车牌号" />
        </div>
        <div class="form-item">
          <label>访问状态</label>
          <Select
            v-model:value="searchForm.status"
            placeholder="请选择状态"
            allow-clear
            class="w-full"
          >
            <Select.Option
              v-for="item in VISITOR_STATUS_OPTIONS"
              :key="item.value"
              :value="item.label"
            >
              {{ item.label }}
            </Select.Option>
          </Select>
        </div>
        <div class="form-item full-width">
          <label>登记时间</label>
          <DatePicker.RangePicker
            v-model:value="searchForm.registerTime"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :placeholder="['开始日期', '结束日期']"
            class="w-full"
          />
        </div>
      </div>
      <div class="form-actions">
        <Button @click="onReset">重置</Button>
        <Button type="primary" @click="onSearch">搜索</Button>
      </div>
    </Card>

    <!-- 列表内容 -->
    <div class="list-container">
      <Spin :spinning="loading">
        <div
          v-if="visitorList.length === 0 && !loading"
          class="empty-container"
        >
          <Empty description="暂无数据" />
        </div>
        <div v-else class="visitor-cards">
          <Card
            v-for="item in visitorList"
            :key="item.visitorId"
            class="visitor-card"
            size="small"
          >
            <div class="card-header">
              <div class="visitor-name">{{ item.visitorName }}</div>
              <Tag :color="getStatusTag(item.status).color">
                {{ getStatusTag(item.status).label }}
              </Tag>
            </div>

            <div class="card-content">
              <div class="info-row" v-if="item.parkName">
                <span class="label">园区：</span>
                <span class="value">{{ item.parkName }}</span>
              </div>
              <div class="info-row" v-if="item.remark">
                <span class="label">来访原因：</span>
                <span class="value">{{ item.remark }}</span>
              </div>
              <div class="info-row" v-if="item.phoneNumber">
                <span class="label">手机号：</span>
                <span class="value">{{ item.phoneNumber }}</span>
              </div>
              <div class="info-row" v-if="item.carNum">
                <span class="label">车牌号：</span>
                <span class="value">{{ item.carNum }}</span>
              </div>
              <div class="info-row" v-if="item.registerTime">
                <span class="label">登记时间：</span>
                <span class="value">{{ formatTime(item.registerTime) }}</span>
              </div>
            </div>

            <div class="card-actions">
              <Button size="small" @click="onView(item)">查看</Button>
              <Button size="small" type="primary" @click="onEdit(item)">
                编辑
              </Button>
              <Button size="small" danger @click="onDelete(item)">删除</Button>
            </div>
          </Card>
        </div>
      </Spin>
    </div>

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination">
      <div class="pagination-info">{{ paginationInfo }}</div>
      <div class="pagination-controls">
        <Button :disabled="!hasPrev" @click="onPageChange(currentPage - 1)">
          上一页
        </Button>
        <span class="page-info">{{ currentPage }}</span>
        <Button :disabled="!hasNext" @click="onPageChange(currentPage + 1)">
          下一页
        </Button>
      </div>
    </div>
  </Page>
</template>

<style scoped>
/* 响应式设计 */
@media (max-width: 480px) {
  .toolbar {
    padding: 8px 12px;
  }

  .search-form {
    margin: 8px 12px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .form-item.full-width {
    grid-column: 1;
  }

  .list-container {
    padding: 8px 12px;
  }

  .visitor-cards {
    gap: 8px;
  }

  .card-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .pagination {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }

  .pagination-controls {
    justify-content: center;
    width: 100%;
  }
}

.mobile-visitor-list {
  padding: 0;
  background-color: #f5f5f5;
}

/* 工具栏样式 */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
}

.toolbar-left {
  flex: 1;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.search-btn,
.refresh-btn {
  padding: 8px;
  border-radius: 6px;
}

.add-btn {
  padding: 8px 12px;
  border-radius: 6px;
}

.icon {
  width: 16px;
  height: 16px;
}

.area-selector {
  max-width: 200px;
}

/* 搜索表单样式 */
.search-form {
  margin: 12px 16px;
  border-radius: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-item.full-width {
  grid-column: 1 / -1;
}

.form-item label {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* 列表容器样式 */
.list-container {
  min-height: 400px;
  padding: 12px 16px;
}

.empty-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
}

/* 访客卡片样式 */
.visitor-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.visitor-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
  transition: all 0.3s ease;
}

.visitor-card:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.visitor-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.card-content {
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  margin-bottom: 6px;
  font-size: 14px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  flex-shrink: 0;
  min-width: 80px;
  color: #666;
}

.value {
  flex: 1;
  color: #333;
  word-break: break-all;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

/* 分页样式 */
.pagination {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: white;
  border-top: 1px solid #f0f0f0;
}

.pagination-info {
  font-size: 14px;
  color: #666;
}

.pagination-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.page-info {
  min-width: 20px;
  font-size: 14px;
  color: #333;
  text-align: center;
}

/* 工具类 */
.w-full {
  width: 100%;
}
</style>
