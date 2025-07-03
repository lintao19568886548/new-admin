<script lang="ts" setup>
import type { RentalManagementItem } from './types';

import { computed, h, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Empty,
  Flex,
  List,
  message,
  Popconfirm,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { deleteTenant, getTenantList } from '#/api/rental';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import {
  calculateIncreaseDateDisplay,
  calculateIncreaseRateDisplay,
  formatAreaDisplay,
  formatContractDateDisplay,
  formatRentDisplay,
  getTagTypeOptions,
} from './data';
import Form from './modules/form.vue';

const currentPark = ref();
const loading = ref(false);
const tenantList = ref<RentalManagementItem[]>([]);
const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0,
});

const isLastPage = computed(
  () => tenantList.value.length >= pagination.value.total,
);

const tagTypeOptions = getTagTypeOptions();

const getStatusTag = (row: RentalManagementItem) => {
  const isExpired = row.contractEnd
    ? dayjs().isAfter(dayjs(row.contractEnd))
    : false;
  const statusText = isExpired ? '过期' : '生效中';
  const option = tagTypeOptions.find((opt) => opt.value === statusText);
  return h(Tag, { color: option?.color || 'default' }, () => statusText);
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function onEdit(row: RentalManagementItem) {
  formModalApi.setData(row).open();
}

function onCreate() {
  formModalApi.setData(null).open();
}

async function onDelete(row: RentalManagementItem) {
  message.loading({
    content: $t('ui.actionMessage.deleting', [row.tenantName || '']),
    duration: 0,
    key: 'action_process_msg',
  });

  try {
    await deleteTenant(row.rentalTenantId);
    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [row.tenantName || '']),
      key: 'action_process_msg',
    });
    // Refresh the list after deletion
    fetchList();
  } catch (error) {
    console.error('删除租户失败:', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [row.tenantName || '']),
      key: 'action_process_msg',
    });
  }
}

async function fetchList(isLoadMore = false) {
  loading.value = true;
  if (!isLoadMore) {
    pagination.value.currentPage = 1;
  }
  const params = {
    currentPage: pagination.value.currentPage,
    currentPark: currentPark.value ? currentPark.value.parkId : -1,
    pageSize: pagination.value.pageSize,
  };
  try {
    const result = await getTenantList(params);
    const newItems = result.items || [];
    if (isLoadMore) {
      tenantList.value.push(...newItems);
    } else {
      tenantList.value = newItems;
    }
    pagination.value.total = result.total || 0;
  } catch (error) {
    console.error('获取租户列表失败:', error);
    message.error('获取租户列表失败');
  } finally {
    loading.value = false;
  }
}

function handleLoadMore() {
  if (isLastPage.value) return;
  pagination.value.currentPage++;
  fetchList(true);
}

function refreshList() {
  tenantList.value = [];
  fetchList();
}

onMounted(() => {
  fetchList();
});
</script>

<template>
  <Page class="mobile-tenant-list-page">
    <FormModal @success="refreshList" />

    <template #header-content>
      <Flex justify="space-between" align="center" class="mobile-header">
        <AreaSelector
          :default-park="currentPark"
          :refresh-callback="refreshList"
          @change="
            (park) => {
              currentPark = park;
              refreshList();
            }
          "
          size="small"
        />
        <Button type="primary" size="small" @click="onCreate">
          <Plus class="size-4" />
          新增合同管理
        </Button>
      </Flex>
    </template>

    <div class="mobile-content">
      <Empty
        v-if="!loading && tenantList.length === 0"
        description="暂无租户数据"
        class="py-10"
      />
      <List
        v-else
        :data-source="tenantList"
        :loading="loading && pagination.currentPage === 1"
        :split="false"
        item-layout="vertical"
        row-key="rentalTenantId"
      >
        <template #renderItem="{ item }">
          <List.Item>
            <Card :bordered="false" class="tenant-card">
              <template #title>
                <div class="card-header">
                  <span class="tenant-name">{{ item.tenantName }}</span>
                  <component :is="getStatusTag(item)" />
                </div>
              </template>

              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">电话:</span>
                  <span>{{ item.phoneNumber || '暂无' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">租金:</span>
                  <span>{{ formatRentDisplay(item.rent) || '暂无' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">面积:</span>
                  <span>{{ formatAreaDisplay(item.area) || '暂无' }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">地址:</span>
                  <span>{{ item.address || '暂无地址' }}</span>
                </div>

                <div class="info-item full-width">
                  <span class="info-label">合同日期:</span>
                  <span>{{
                    formatContractDateDisplay(item) || '暂无合同日期'
                  }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="info-label">下次递增:</span>
                  <span>{{
                    `${calculateIncreaseRateDisplay(item) || '无'} (${
                      calculateIncreaseDateDisplay(item) || '无'
                    })`
                  }}</span>
                </div>
              </div>

              <template #actions>
                <Button type="text" @click="onEdit(item)">
                  <template #icon><EditOutlined /></template>
                  {{ $t('ui.action.edit') }}
                </Button>
                <Popconfirm
                  :title="
                    $t('ui.actionMessage.deleteConfirm', [item.tenantName])
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
            v-else-if="tenantList.length > 0"
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
.mobile-tenant-list-page {
  background-color: #f5f5f5;
}

.mobile-header {
  padding: 12px 16px;
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.mobile-content {
  padding: 8px;
}

:deep(.ant-list-item) {
  padding: 8px 0 !important;
  border: none !important;
}

.tenant-card {
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

.tenant-name {
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
  width: max-content;
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

.load-more-container {
  padding: 16px 0;
}

.load-more-container.no-more {
  font-size: 14px;
  color: #999;
  text-align: center;
}
</style>
