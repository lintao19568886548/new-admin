<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import { computed, h, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  message,
  Popconfirm,
  Row,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { deleteFactory, getFactoryList } from '#/api/factory/factory';
import { $t } from '#/locales';
import { useLayoutStore } from '#/store/layout';

import FactoryForm from './modules/form.vue';

const loading = ref(false);
const searchForm = ref({
  address: '',
  contact: '',
  factoryName: '',
});
const factoryList = ref<RentalManagementItem[]>([]);
const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0,
});

const layoutStore = useLayoutStore();

const isLastPage = computed(
  () => factoryList.value.length >= pagination.value.total,
);

/**
 * 获取厂房类型标签
 */
const getFactoryTypeTag = (row: RentalManagementItem) => {
  const typeText = row.isOwn ? '自有' : '入驻';
  const color = row.isOwn ? 'blue' : 'green';
  return h(Tag, { color }, () => typeText);
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: FactoryForm,
  destroyOnClose: true,
});

/**
 * 编辑厂房
 */
function onEdit(row: RentalManagementItem) {
  formModalApi.setData(row).open();
}

/**
 * 创建新厂房
 */
function onCreate() {
  formModalApi.setData(null).open();
}

/**
 * 删除厂房
 */
async function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.factoryName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteFactory(Number(row.factoryId));
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.factoryName || '']),
      key: 'action_process_msg',
    });
    // 刷新列表
    fetchList();
  } catch (error) {
    console.error('删除厂房失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [row.factoryName || '']),
      key: 'action_process_msg',
    });
  }
}

/**
 * 查看厂房详情
 */
function onView(row: RentalManagementItem) {
  // 可以跳转到详情页面或打开详情弹窗
  message.info(`查看厂房详情: ${row.factoryName}`);
}

/**
 * 获取厂房列表
 */
async function fetchList(isLoadMore = false) {
  loading.value = true;
  if (!isLoadMore) {
    pagination.value.currentPage = 1;
  }
  const params = {
    ...searchForm.value,
    currentPage: pagination.value.currentPage,
    isOwn: false, // 只查询入驻厂房
    pageSize: pagination.value.pageSize,
  };
  try {
    const result = await getFactoryList(params);
    const newItems = result.items || [];
    if (isLoadMore) {
      factoryList.value.push(...newItems);
    } else {
      factoryList.value = newItems;
    }
    pagination.value.total = result.total || 0;
  } catch (error) {
    console.error('获取厂房列表失败:', error);
    message.error('获取厂房列表失败');
  } finally {
    loading.value = false;
  }
}

/**
 * 搜索厂房
 */
function handleSearch() {
  fetchList();
}

/**
 * 重置搜索条件
 */
function resetSearch() {
  searchForm.value = {
    address: '',
    contact: '',
    factoryName: '',
  };
  fetchList();
}

/**
 * 加载更多
 */
function handleLoadMore() {
  if (isLastPage.value) return;
  pagination.value.currentPage++;
  fetchList(true);
}

/**
 * 刷新列表
 */
function refreshList() {
  fetchList();
}

/**
 * 格式化建造时间显示
 */
function formatBuildTimeDisplay(buildTime?: string) {
  if (!buildTime) return '未知';
  return dayjs(buildTime).format('YYYY年MM月');
}

onMounted(() => {
  fetchList();
  layoutStore.setHeaderActions([
    {
      key: 'create-factory',
      onClick: onCreate,
      text: '新增',
    },
  ]);
});

onUnmounted(() => {
  layoutStore.clearHeaderActions();
});
</script>

<template>
  <Page class="mobile-factory-list-page">
    <FormModal @success="refreshList" />

    <details class="search-details">
      <summary class="search-summary">
        筛选条件 <Search class="inline-icon" />
      </summary>
      <div class="search-form-container">
        <Form :model="searchForm" layout="vertical">
          <Row :gutter="16">
            <Col :span="12">
              <Form.Item label="厂房名称">
                <Input
                  v-model:value="searchForm.factoryName"
                  allow-clear
                  placeholder="请输入"
                />
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item label="联系人">
                <Input
                  v-model:value="searchForm.contact"
                  allow-clear
                  placeholder="请输入"
                />
              </Form.Item>
            </Col>
            <Col :span="24">
              <Form.Item label="厂房地址">
                <Input
                  v-model:value="searchForm.address"
                  allow-clear
                  placeholder="请输入"
                />
              </Form.Item>
            </Col>
          </Row>
          <div class="search-actions">
            <Button @click="resetSearch" type="default" class="flex-1">
              重置
            </Button>
            <Button @click="handleSearch" type="primary" class="flex-1">
              <template #icon><Search /></template>
              查询
            </Button>
          </div>
        </Form>
      </div>
    </details>

    <div class="mobile-content">
      <Empty
        v-if="!loading && factoryList.length === 0"
        description="暂无厂房数据"
        class="py-10"
      />
      <List
        v-else
        :data-source="factoryList"
        :loading="loading && pagination.currentPage === 1"
        :split="false"
        item-layout="vertical"
        row-key="factoryId"
      >
        <template #renderItem="{ item }">
          <List.Item>
            <Card :bordered="false" class="factory-card">
              <template #title>
                <div class="card-header">
                  <span class="factory-name">{{ item.factoryName }}</span>
                  <component :is="getFactoryTypeTag(item)" />
                </div>
              </template>

              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">联系人:</span>
                  <span>{{ item.contact || '暂无' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">建造时间:</span>
                  <span>{{ formatBuildTimeDisplay(item.buildTime) }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">地址:</span>
                  <span>{{ item.address || '暂无地址' }}</span>
                </div>
                <div class="info-item full-width" v-if="item.description">
                  <span class="info-label">描述:</span>
                  <span>{{ item.description }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">创建时间:</span>
                  <span>{{
                    item.createTime
                      ? dayjs(item.createTime).format('YYYY-MM-DD HH:mm')
                      : '未知'
                  }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">更新时间:</span>
                  <span>{{
                    item.updateTime
                      ? dayjs(item.updateTime).format('YYYY-MM-DD HH:mm')
                      : '未知'
                  }}</span>
                </div>
              </div>

              <template #actions>
                <Button type="text" @click="onView(item)">
                  <template #icon><EyeOutlined /></template>
                  查看
                </Button>
                <Button type="text" @click="onEdit(item)">
                  <template #icon><EditOutlined /></template>
                  {{ $t('ui.action.edit') }}
                </Button>
                <Popconfirm
                  :title="
                    $t('ui.actionMessage.deleteConfirm', [item.factoryName])
                  "
                  @confirm="onDelete(item)"
                  placement="top"
                  :overlay-style="{ maxWidth: '250px' }"
                >
                  <Button
                    type="text"
                    status="danger"
                    :aria-label="$t('ui.action.delete')"
                  >
                    <template #icon><DeleteOutlined /></template>
                    {{ $t('ui.action.delete') }}
                  </Button>
                </Popconfirm>
              </template>
            </Card>
          </List.Item>
        </template>
        <template #loadMore>
          <div v-if="!isLastPage" class="load-more-container">
            <Button @click="handleLoadMore" :loading="loading" block>
              加载更多
            </Button>
          </div>
          <div
            v-else-if="factoryList.length > 0"
            class="load-more-container no-more"
          >
            没有更多了
          </div>
        </template>
      </List>
    </div>
  </Page>
</template>

<style scoped>
.mobile-factory-list-page {
  padding: 8px;
  background-color: #f5f5f5;
}

.mobile-content {
  padding: 0;
}

:deep(.ant-list-item) {
  padding: 8px 0 !important;
  border: none !important;
}

.factory-card {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 9%);
}

:deep(.ant-card-head) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: auto;
  padding: 10px 16px;
  font-size: 16px;
}

:deep(.ant-card-head-title) {
  flex: 1 1 auto;
  padding: 0;
}

:deep(.ant-card-extra) {
  flex: 0 0 auto;
  padding: 0;
  margin-left: 8px;
}

:deep(.ant-card-body) {
  padding: 12px 16px;
}

:deep(.ant-card-actions) {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  padding: 10px 16px;
  font-size: 15px;
  background-color: #fff;
}

:deep(.ant-card-actions > li) {
  flex: 0 1 auto;
  justify-content: space-between;
  margin: 0 !important;
  text-align: center;
  border-right: none !important;
}

.card-header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.factory-name {
  font-size: 17px;
  font-weight: 500;
  word-break: break-all;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 15px;
  color: #555;
}

.info-item {
  display: flex;
  align-items: start;
  overflow: hidden;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-label {
  flex-shrink: 0;
  padding-right: 8px;
  color: #888;
  text-align: left;
}

.info-item > span:last-of-type {
  word-break: break-word;
}

.search-details {
  padding: 0;
  margin-bottom: 12px;
  background-color: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 17px;
  cursor: pointer;
}

.search-summary .inline-icon {
  width: 1em;
  height: 1em;
}

.search-form-container {
  padding: 12px;
  border-top: 1px solid #e8e8e8;
}

.search-form-container .ant-form-item {
  margin-bottom: 12px;
}

.search-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.flex-1 {
  flex: 1;
}

.load-more-container {
  padding: 16px 0;
}

.load-more-container.no-more {
  font-size: 14px;
  color: #999;
  text-align: center;
}
</style>
