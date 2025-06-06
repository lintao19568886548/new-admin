<script lang="ts" setup>
import type { FinanceItem } from './types';

import { onMounted, ref, shallowRef } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  Modal as AModal,
  Button,
  Empty,
  message,
  Pagination,
  Spin,
  Tag,
} from 'ant-design-vue'; // Renamed Modal to AModal to avoid conflict

import { useVbenForm } from '#/adapter/form';
import { deleteFinance, getFinanceList } from '#/api/finance';
import AreaSelector from '#/components/AreaSelector.vue';
import { $t } from '#/locales';

import { getTagTypeOptions, useGridFormSchema } from './data';
import MobileForm from './modules/mobile-form.vue';

interface QueryParams {
  [key: string]: any;
  currentPage?: number;
  endTime?: string;
  pageSize?: number;
  startTime?: string;
}

const loading = shallowRef(false);
const financeList = shallowRef<FinanceItem[]>([]);
const paginationState = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0,
});

const searchParams = ref<Partial<QueryParams>>({});
const currentPark = ref<any>(); // For AreaSelector

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: MobileForm,
  destroyOnClose: true,
});

const tagOptions = getTagTypeOptions();
const getTagDisplay = (value: string) => {
  const option = tagOptions.find((opt) => opt.value === value);
  return option
    ? { color: option.color, text: option.label }
    : { color: 'default', text: value };
};

async function fetchFinanceData(params: QueryParams = {}) {
  loading.value = true;
  try {
    const query: QueryParams = {
      ...searchParams.value,
      currentPage: params.currentPage || paginationState.value.currentPage,
      pageSize: params.pageSize || paginationState.value.pageSize,
      parkId: currentPark.value?.parkId, // Add parkId from AreaSelector
    };

    const activeQueryParams: Record<string, any> = {};
    for (const key in query) {
      if (
        query[key] !== null &&
        query[key] !== undefined &&
        query[key] !== ''
      ) {
        activeQueryParams[key] = query[key];
      }
    }
    // Handle date range specifically for API if 'transactionTime' is an array from RangePicker
    if (
      activeQueryParams.transactionTime &&
      Array.isArray(activeQueryParams.transactionTime)
    ) {
      activeQueryParams.startTime = activeQueryParams.transactionTime[0];
      activeQueryParams.endTime = activeQueryParams.transactionTime[1];
      delete activeQueryParams.transactionTime; // Remove original array
    }

    const result = await getFinanceList(activeQueryParams as any);
    financeList.value = result.items || [];
    paginationState.value.total = result.total || 0;
    paginationState.value.currentPage = activeQueryParams.currentPage as number;
    paginationState.value.pageSize = activeQueryParams.pageSize as number;
  } catch (error) {
    message.error($t('page.finance.fetchFailed'));
    console.error('Fetch finance data failed:', error);
  } finally {
    loading.value = false;
  }
}

// Simplified search schema for mobile - reuse or adapt from data.ts as needed
const simplifiedSearchSchema = useGridFormSchema().map((s) => {
  if (s.fieldName === 'amount') {
    return {
      ...s,
      componentProps: {
        ...s.componentProps,
        placeholder: $t('page.finance.amountPlaceholderMobile'),
      },
    };
  }
  return s;
});

const [SearchForm, searchFormApi] = useVbenForm({
  layout: 'vertical',
  schema: simplifiedSearchSchema,
  showDefaultActions: false, // Custom buttons for search and reset
});

async function handleSearch() {
  paginationState.value.currentPage = 1;
  searchParams.value = await searchFormApi.getValues();
  fetchFinanceData();
}

function handleResetSearch() {
  searchFormApi.resetForm();
  searchParams.value = {};
  paginationState.value.currentPage = 1;
  fetchFinanceData();
}

function handleAddNew() {
  formModalApi.setData(null).open();
}

function handleEdit(item: FinanceItem) {
  formModalApi.setData(item).open();
}

function handleDelete(item: FinanceItem) {
  AModal.confirm({
    cancelText: $t('common.cancel'),
    content: $t('ui.actionMessage.deleteConfirm', [item.billName]),
    okText: $t('common.delete'),
    okType: 'danger',
    onOk: async () => {
      const hideLoading = message.loading(
        $t('ui.actionMessage.deleting', [item.billName]),
        0,
      );
      try {
        await deleteFinance(item.financeId);
        message.success($t('ui.actionMessage.deleteSuccess', [item.billName]));
        fetchFinanceData(); // Refresh list
      } catch (error) {
        message.error($t('ui.actionMessage.deleteFailed', [item.billName]));
        console.error('Delete failed:', error);
      } finally {
        hideLoading();
      }
    },
    title: $t('ui.actionTitle.deleteConfirm'),
  });
}

function onPageChange(page: number, pageSize: number) {
  paginationState.value.currentPage = page;
  paginationState.value.pageSize = pageSize;
  fetchFinanceData();
}

async function onAreaChange(area: any) {
  currentPark.value = area;
  await handleSearch(); // Trigger search when area changes
}

onMounted(() => {
  fetchFinanceData();
});
</script>

<template>
  <Page auto-content-height class="mobile-finance-list-container">
    <FormModal @success="fetchFinanceData" />

    <div class="page-header">
      <AreaSelector
        :default-area="currentPark"
        :refresh-callback="fetchFinanceData"
        @change="onAreaChange"
        class="area-selector-mobile"
      />
      <Button type="primary" @click="handleAddNew" block class="add-button">
        <Plus class="size-5" />
        {{ $t('page.finance.create') }}
      </Button>
    </div>

    <details class="search-details">
      <summary class="search-summary">
        {{ $t('common.searchFilter') }} <Search class="inline-icon" />
      </summary>
      <div class="search-form-container">
        <SearchForm />
        <div class="search-actions-buttons">
          <Button type="primary" @click="handleSearch" block>
            {{ $t('common.search') }}
          </Button>
          <Button @click="handleResetSearch" block>
            {{ $t('common.reset') }}
          </Button>
        </div>
      </div>
    </details>

    <Spin :spinning="loading">
      <div v-if="financeList.length > 0" class="finance-card-list">
        <div
          v-for="item in financeList"
          :key="item.financeId"
          class="finance-card"
        >
          <div class="card-header">
            <span class="bill-name">{{ item.billName }}</span>
            <Tag :color="getTagDisplay(item.transactionType).color">
              {{ getTagDisplay(item.transactionType).text }}
            </Tag>
          </div>
          <div class="card-content">
            <p>
              <strong>{{ $t('page.finance.billCategory') }}:</strong>
              {{ item.billCategory }}
            </p>
            <p>
              <strong>{{ $t('page.finance.amount') }}:</strong>
              <!-- eslint-disable-next-line vue/html-closing-bracket-newline -->
              <span
                :class="
                  item.transactionType === '收入'
                    ? 'amount-income'
                    : 'amount-expense'
                "
              >
                ¥{{ Number(item.amount).toFixed(2) }}
              </span>
            </p>
            <p>
              <strong>{{ $t('page.finance.transactionTime') }}:</strong>
              {{ formatDateTime(item.transactionTime) }}
            </p>
            <p v-if="item.remark">
              <strong>{{ $t('page.finance.remark') }}:</strong>
              {{ item.remark }}
            </p>
          </div>
          <div class="card-actions">
            <Button size="small" @click="handleEdit(item)">
              {{ $t('common.edit') }}
            </Button>
            <Button size="small" type="link" danger @click="handleDelete(item)">
              {{ $t('common.delete') }}
            </Button>
          </div>
        </div>
      </div>
      <Empty
        v-else
        :description="
          loading ? $t('common.loading') : $t('page.finance.noData')
        "
      />
    </Spin>

    <Pagination
      v-if="paginationState.total > 0"
      :current="paginationState.currentPage"
      :page-size="paginationState.pageSize"
      :total="paginationState.total"
      @change="onPageChange"
      size="small"
      class="list-pagination"
      :show-size-changer="false"
    />
  </Page>
</template>

<style scoped>
.mobile-finance-list-container {
  padding: 8px;
  background-color: #f0f2f5;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.area-selector-mobile {
  width: 100%;
}

.add-button {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  font-size: 1em;
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
  font-weight: bold;
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

.search-actions-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.search-actions-buttons .ant-btn {
  flex-grow: 1;
}

.finance-card-list {
  padding-bottom: 8px;
}

.finance-card {
  padding: 12px;
  margin-bottom: 8px;
  background-color: #fff;
  border-radius: 4px;
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

.bill-name {
  font-size: 1.1em;
  font-weight: bold;
  color: #333;
}

.card-content p {
  margin-bottom: 4px;
  font-size: 0.9em;
  line-height: 1.5;
  color: #555;
}

.card-content p strong {
  display: inline-block;
  min-width: 70px; /* Ensure alignment */
  color: #333;
}

.amount-income {
  font-weight: bold;
  color: #52c41a; /* Ant Design green */
}

.amount-expense {
  font-weight: bold;
  color: #f5222d; /* Ant Design red */
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 8px;
  margin-top: 10px;
  text-align: right;
  border-top: 1px solid #f0f0f0;
}

.list-pagination {
  margin-top: 12px;
  text-align: center;
}
</style>
