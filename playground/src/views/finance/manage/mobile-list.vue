<!-- eslint-disable vue/html-closing-bracket-newline -->
<script lang="ts" setup>
import type { FinanceItem as BaseFinanceItem } from './types';

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Carousel,
  Col,
  Empty,
  Form,
  Image,
  Input,
  message,
  Modal,
  Pagination,
  Row,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { deleteFinance, getFinanceList } from '#/api/finance';
import { getParkList as fetchParks } from '#/api/park';
import { $t } from '#/locales';
import { useLayoutStore } from '#/store/layout';

import { getTagTypeOptions } from './data';
import FormModal from './modules/form.vue';

type ParkList = Awaited<ReturnType<typeof fetchParks>>;
type ParkItem = ParkList[number];

interface FinanceItem extends BaseFinanceItem {
  formattedAmount?: string;
  images?: { url: string }[];
}

const [VbenFormModal, formModalApi] = useVbenModal({
  connectedComponent: FormModal,
  destroyOnClose: true,
});

const bills = ref<FinanceItem[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const loading = ref(false);

const layoutStore = useLayoutStore();

const parkOptions = ref<{ label: string; value: number }[]>([]);

// 搜索表单
const searchForm = reactive({
  billName: '',
  parkId: undefined,
  transactionType: undefined,
});
const transactionTypeOptions = getTagTypeOptions();

const getTagDisplay = (value: string) => {
  const option = getTagTypeOptions().find((opt) => opt.value === value);
  const color = option?.color || 'default';
  return {
    bgColor: color === 'green' ? 'bg-green-500' : 'bg-red-500',
    color,
    text: option?.label || value,
  };
};

async function fetchBillList() {
  if (loading.value) return;
  loading.value = true;

  try {
    const params: Record<string, any> = {
      currentPage: pagination.current,
      pageSize: pagination.pageSize,
      ...searchForm,
    };

    const result = await getFinanceList(params);

    processBills(result);
  } catch (error: any) {
    message.error(error?.message || '获取账单列表失败');
  } finally {
    loading.value = false;
  }
}

function processBills(result: { items: BaseFinanceItem[]; total: number }) {
  if (result && result.items && typeof result.total === 'number') {
    bills.value = result.items.map((item) => {
      return {
        ...item,
        formattedAmount: `¥ ${Number(item.amount).toFixed(2)}`,
        images: item.images || [],
        transactionTime: formatDateTime(item.transactionTime),
      } as FinanceItem;
    });
    pagination.total = result.total;
  }
}

function getParkName(parkId?: number): string {
  if (parkId === undefined || parkId === null) {
    return '';
  }
  const park = parkOptions.value.find((p) => p.value === parkId);
  return park?.label || '';
}

async function fetchParkOptions() {
  try {
    const parks = await fetchParks();
    parkOptions.value = parks.map((park: ParkItem) => ({
      label: park.parkName,
      value: park.parkId,
    }));
  } catch (error) {
    console.error($t('page.finance.fetchParksFailed'), error);
  }
}

onMounted(() => {
  fetchBillList();
  fetchParkOptions();
  layoutStore.setHeaderActions([
    {
      // icon: PlusOutlined,
      key: 'add-bill',
      onClick: () => handleCreate(),
      text: $t('page.common.add'),
    },
  ]);
});

onUnmounted(() => {
  layoutStore.clearHeaderActions();
});

function handlePageChange(page: number, pageSize: number) {
  pagination.current = page;
  pagination.pageSize = pageSize;
  fetchBillList();
}

function handleSearch() {
  pagination.current = 1;
  fetchBillList();
}

function resetSearch() {
  searchForm.billName = '';
  searchForm.parkId = undefined;
  searchForm.transactionType = undefined;
  handleSearch();
}

function refreshList() {
  fetchBillList();
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
    centered: true,
    content: $t('ui.actionMessage.deleteConfirm', [
      item.billName || $t('page.finance.thisRecord'),
    ]),
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
        console.error($t('page.finance.deleteFailedLog'), error);
        message.error({
          content: $t('ui.actionMessage.deleteFailed', [item.billName]),
          key: 'action_process_msg',
        });
      }
    },
    title: $t('page.common.confirmDelete'),
  });
}

function handleFormSuccess() {
  refreshList();
}

const listIsEmpty = computed(() => !loading.value && bills.value.length === 0);

function getTransactionTypeClass(type: string) {
  return type === '收入' ? 'text-green-500' : 'text-red-500';
}
</script>

<template>
  <div class="finance-mobile-page">
    <VbenFormModal @success="handleFormSuccess" />

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
            <Form.Item :label="$t('page.finance.billName')">
              <Input
                v-model:value="searchForm.billName"
                :placeholder="$t('page.finance.searchBillName')"
                allow-clear
              />
            </Form.Item>
          </Col>
          <Col :span="12">
            <Form.Item :label="$t('page.finance.transactionType')">
              <Select
                v-model:value="searchForm.transactionType"
                :options="transactionTypeOptions"
                :placeholder="$t('page.finance.selectType')"
                allow-clear
              />
            </Form.Item>
          </Col>
        </Row>
        <div class="search-actions">
          <Button type="primary" @click="handleSearch" class="flex-1">
            <Search class="mr-1 h-4 w-4" />
            {{ $t('common.search') }}
          </Button>
          <Button @click="resetSearch" class="flex-1">
            {{ $t('common.reset') }}
          </Button>
        </div>
      </Form>
    </div>

    <Spin :spinning="loading" :tip="$t('ui.loading')">
      <div v-if="bills.length > 0">
        <Card
          v-for="item in bills"
          :key="item.financeId"
          class="bill-card"
          :body-style="{ padding: '0' }"
        >
          <div class="card-header">
            <span class="bill-title">{{ item.billName }}</span>
            <div class="header-tags">
              <Tag :color="getTagDisplay(item.transactionType).color">
                {{ getTagDisplay(item.transactionType).text }}
              </Tag>
              <Tag v-if="item.billCategory" color="cyan">
                {{ item.billCategory }}
              </Tag>
            </div>
          </div>
          <div class="card-content">
            <!-- Amount -->
            <div class="mb-4 text-center">
              <span class="info-label">{{
                $t('page.finance.amountShort')
              }}</span>
              <p
                :class="getTransactionTypeClass(item.transactionType)"
                class="amount"
              >
                {{ item.formattedAmount }}
              </p>
            </div>

            <!-- Park & Time -->
            <div class="mb-3 grid grid-cols-2 gap-4">
              <div v-if="getParkName(item.parkId)" class="info-item text-left">
                <span class="info-label">{{ $t('page.park.item') }}</span>
                <span class="info-value">{{ getParkName(item.parkId) }}</span>
              </div>
              <div
                class="info-item text-left"
                :class="{
                  'col-span-2': !getParkName(item.parkId),
                }"
              >
                <span class="info-label">{{
                  $t('page.finance.transactionTime')
                }}</span>
                <span class="info-value">{{ item.transactionTime }}</span>
              </div>
            </div>
            <p v-if="item.remark" class="remark-info">
              <span class="remark-label">{{ $t('page.finance.remark') }}:</span>
              <span class="remark-text">{{ item.remark }}</span>
            </p>
            <div
              v-if="item.images && item.images.length > 0"
              class="card-images"
            >
              <Image.PreviewGroup>
                <Carousel
                  class="image-carousel"
                  :adaptive-height="true"
                  :dots="item.images.length > 1"
                  :infinite="false"
                >
                  <Image
                    v-for="image in item.images"
                    :key="image.url"
                    :src="image.url"
                    class="carousel-main-image"
                  />
                </Carousel>
              </Image.PreviewGroup>
            </div>
          </div>
          <div class="card-actions">
            <Button type="primary" ghost @click="handleEdit(item)">
              {{ $t('common.edit') }}
            </Button>
            <Button type="primary" danger ghost @click="handleDelete(item)">
              {{ $t('common.delete') }}
            </Button>
          </div>
        </Card>

        <Pagination
          v-if="pagination.total > pagination.pageSize"
          v-model:current="pagination.current"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @change="handlePageChange"
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
  </div>
</template>

<style scoped>
.finance-mobile-page {
  box-sizing: border-box;
  padding: 8px;
  background-color: #f0f2f5;
}

.dark .finance-mobile-page {
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

.bill-card {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 14px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
}

.dark .bill-card {
  background-color: #2d2d2d;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.dark .card-header {
  border-bottom-color: #424242;
}

.bill-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  word-break: break-word;
  white-space: normal;
}

.dark .bill-title {
  color: #f1f1f1;
}

.header-tags {
  display: flex;
  gap: 8px;
  align-items: center;
}

.card-content {
  padding: 16px;
}

.amount-display {
  margin-bottom: 16px;
  text-align: left;
}

.amount-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #969799;
}

.dark .amount-label {
  color: #a0a0a0;
}

.amount {
  font-size: 24px;
  font-weight: 600;
}

.text-green-500 {
  color: #4caf50;
}

.text-red-500 {
  color: #f44336;
}

.info-item {
  display: flex;
  flex-direction: column;
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
  font-size: 14px;
  color: #323233;
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
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.dark .card-actions {
  border-top-color: #424242;
}

.list-pagination {
  padding-bottom: 10px;
  margin-top: 10px;
  text-align: center;
}

.card-images {
  margin-top: 16px;
}

.image-carousel {
  overflow: hidden;
  border-radius: 6px;
}

.carousel-main-image {
  width: 100%;
  height: auto;
  max-height: 40vh; /* 限制最大高度为视口的40% */
  object-fit: contain; /* 保证图片完整显示 */
}

:deep(.image-carousel .slick-dots-bottom) {
  bottom: 5px;
}

:deep(.image-carousel .slick-dots li button) {
  background: #fff;
  opacity: 0.5;
}

:deep(.image-carousel .slick-dots li.slick-active button) {
  background: #fff;
  opacity: 1;
}
</style>
