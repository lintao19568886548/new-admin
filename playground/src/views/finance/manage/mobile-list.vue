<!-- eslint-disable vue/html-closing-bracket-newline -->
<script lang="ts" setup>
import type { FinanceItem } from './types';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { MoreOutlined, PlusOutlined } from '@ant-design/icons-vue';
import {
  Avatar,
  Button,
  Dropdown,
  Empty,
  List,
  Menu,
  MenuItem,
  message,
  Modal,
  Spin,
  Tag,
} from 'ant-design-vue';

import { deleteFinance, getFinanceList } from '#/api/finance';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { getTagTypeOptions } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const bills = ref<FinanceItem[]>([]);
const currentPage = ref(1);
const pageSize = ref(15);
const totalBills = ref(0);
const loading = ref(false);
const allLoaded = ref(false);

const currentPark = ref();
const parkSelectorRef = ref();

const tagOptions = getTagTypeOptions();
const getTagDisplay = (value: string) => {
  const option = tagOptions.find((opt) => opt.value === value);
  const color = option?.color || 'default';
  return {
    bgColor: color === 'green' ? 'bg-green-500' : 'bg-red-500',
    color,
    text: option?.label || value,
  };
};

const formatFee = (value?: number | string) => {
  const numValue = Number(value);
  return Number.isNaN(numValue) ? '¥ 0.00' : `¥ ${numValue.toFixed(2)}`;
};

async function fetchBillList(isRefresh = false) {
  if (loading.value || (!isRefresh && allLoaded.value)) return;
  loading.value = true;
  if (isRefresh) {
    currentPage.value = 1;
    bills.value = [];
    allLoaded.value = false;
  }

  try {
    const params: Record<string, any> = {
      currentPage: currentPage.value,
      pageSize: pageSize.value,
      parkId: currentPark.value ? currentPark.value.parkId : -1,
    };

    const result = await getFinanceList(params);

    if (result && result.items && typeof result.total === 'number') {
      bills.value = [...bills.value, ...result.items];
      totalBills.value = result.total;
      if (bills.value.length >= totalBills.value) {
        allLoaded.value = true;
      }
    } else {
      message.warn('获取账单列表失败，数据结构异常。');
      bills.value = [];
      totalBills.value = 0;
    }
  } catch (error: any) {
    message.error(error?.message || '获取账单列表失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchBillList(true);
});

function handleLoadMore() {
  if (!allLoaded.value) {
    currentPage.value++;
    fetchBillList();
  }
}

function refreshList() {
  fetchBillList(true);
}

function handleCreate() {
  formModalApi.setData({}).open();
}

async function handleEdit(item: FinanceItem) {
  formModalApi.setData({ ...item }).open();
}

async function handleDelete(item: FinanceItem) {
  Modal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('ui.actionMessage.deleteConfirm', [item.billName || '该记录']),
    okText: $t('common.confirm'),
    okType: 'danger',
    async onOk() {
      if (!item.financeId) return;
      try {
        message.loading({
          content: $t('ui.actionMessage.deleting', [item.billName]),
          duration: 0,
          key: 'action_process_msg',
        });
        await deleteFinance(item.financeId);
        message.success({
          content: $t('ui.actionMessage.deleteSuccess', [item.billName]),
          key: 'action_process_msg',
        });
        refreshList();
      } catch (error) {
        console.error('删除失败:', error);
        message.error({
          content: $t('ui.actionMessage.deleteFailed', [item.billName]),
          key: 'action_process_msg',
        });
      }
    },
    title: $t('common.confirmDelete'),
  });
}

function handleFormSuccess() {
  refreshList();
}

function onParkChange(park: any) {
  currentPark.value = park;
  refreshList();
}

const listIsEmpty = computed(() => !loading.value && bills.value.length === 0);
</script>

<template>
  <Page
    :title="$t('page.finance.mobileTitle', '财务明细')"
    class="finance-mobile-page"
  >
    <FormModal @success="handleFormSuccess" />
    <div
      class="relative z-10 flex items-center justify-between bg-white p-2 shadow-sm dark:bg-black"
    >
      <AreaSelector
        :default-area="currentPark"
        :refresh-callback="refreshList"
        @change="onParkChange"
        ref="parkSelectorRef"
        size="small"
      />
      <Button type="primary" @click="handleCreate" size="small">
        <PlusOutlined /> {{ $t('page.finance.createBill', '新增账单') }}
      </Button>
    </div>

    <div class="p-2">
      <Spin :spinning="loading && currentPage === 1">
        <List
          item-layout="horizontal"
          :data-source="bills"
          :loading="loading && currentPage > 1"
          :split="false"
        >
          <template #renderItem="{ item }: { item: FinanceItem }">
            <List.Item
              class="mb-2 rounded-md bg-white p-3 shadow-sm dark:bg-zinc-800"
            >
              <template #actions>
                <Dropdown placement="bottomRight" :trigger="['click']">
                  <Button type="text" size="small" class="px-1" @click.stop>
                    <MoreOutlined class="text-lg text-gray-500" />
                  </Button>
                  <template #overlay>
                    <Menu>
                      <MenuItem @click="handleEdit(item)">
                        {{ $t('common.edit') }}
                      </MenuItem>
                      <MenuItem @click="handleDelete(item)" danger>
                        {{ $t('common.delete') }}
                      </MenuItem>
                    </Menu>
                  </template>
                </Dropdown>
              </template>
              <List.Item.Meta>
                <template #title>
                  <div class="flex items-center">
                    <span class="font-semibold">{{ item.billName }}</span>
                    <Tag
                      v-if="item.billCategory"
                      color="cyan"
                      class="ml-2 text-xs"
                    >
                      {{ item.billCategory }}
                    </Tag>
                  </div>
                </template>
                <template #description>
                  <div class="mt-1 text-sm">
                    <span
                      :class="
                        item.transactionType === '收入'
                          ? 'text-green-500'
                          : 'text-red-500'
                      "
                      class="font-medium"
                      >{{ formatFee(item.amount) }}
                    </span>
                    <p
                      v-if="item.transactionTime"
                      class="mt-1 text-xs text-gray-400"
                    >
                      {{ formatDateTime(item.transactionTime) }}
                    </p>
                  </div>
                </template>
                <template #avatar>
                  <Avatar
                    shape="circle"
                    :class="getTagDisplay(item.transactionType).bgColor"
                    class="flex-shrink-0 text-white"
                  >
                    {{ getTagDisplay(item.transactionType).text.charAt(0) }}
                  </Avatar>
                </template>
              </List.Item.Meta>
            </List.Item>
          </template>

          <template #loadMore v-if="!allLoaded && !loading">
            <div class="my-4 text-center">
              <Button @click="handleLoadMore">加载更多</Button>
            </div>
          </template>
          <template #header v-if="listIsEmpty">
            <Empty
              class="py-10"
              :description="$t('page.finance.noData', '暂无财务数据')"
            />
          </template>
        </List>
      </Spin>
    </div>
  </Page>
</template>

<style scoped>
.finance-mobile-page {
  background-color: #f0f2f5;
}

.dark .finance-mobile-page {
  background-color: #1a1a1a;
}
</style>
