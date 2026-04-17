<!-- eslint-disable vue/html-closing-bracket-newline -->
<script lang="ts" setup>
import type { FinanceItem as BaseFinanceItem } from './types';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';
import { Search } from '@vben/icons';
import { formatDateTime } from '@vben/utils';

import { PlusOutlined } from '@ant-design/icons-vue';
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
  Switch,
  Tag,
} from 'ant-design-vue';

import { deleteAllFinance, deleteFinance, getFinanceList } from '#/api/finance';
import { getParkList as fetchParks } from '#/api/park';
import SmsVerificationModal from '#/components/SmsVerificationModal.vue';
import { useSmsActionVerification } from '#/hooks/useSmsActionVerification';
import { $t } from '#/locales';

import { getTagTypeOptions } from './data';
import FormModal from './modules/form.vue';

type ParkList = Awaited<ReturnType<typeof fetchParks>>;
type ParkItem = ParkList[number];

interface FinanceItem extends BaseFinanceItem {
  images?: { url: string }[];
}

const [VbenFormModal, formModalApi] = useVbenModal({
  connectedComponent: FormModal,
  destroyOnClose: true,
});

const verificationModalRef = ref<InstanceType<typeof SmsVerificationModal>>();
const deleteVerificationModalRef =
  ref<InstanceType<typeof SmsVerificationModal>>();

const bills = ref<FinanceItem[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const loading = ref(false);

const route = useRoute();
const router = useRouter();

const isVerified = ref(false);
const isDev = import.meta.env.DEV;
const DELETE_VERIFY_STORAGE_KEY = 'finance-delete-verified-at';

const parkOptions = ref<{ label: string; value: number }[]>([]);

// 脱敏开关 - 从 localStorage 读取持久化状态
const enableMask = ref(localStorage.getItem('finance-enableMask') !== 'false');

const {
  ensureVerified: ensureDeleteVerified,
  handleVerificationCancel: onDeleteVerificationCancel,
  handleVerificationSuccess: onDeleteVerificationSuccess,
} = useSmsActionVerification({
  modalRef: deleteVerificationModalRef,
  storageKey: DELETE_VERIFY_STORAGE_KEY,
  uninitializedMessage: '删除验证组件未初始化',
  validDurationMs: 0,
});

// 格式化金额（带脱敏）
function formatAmount(amount: number | string): string {
  const num = Number(amount);
  if (!enableMask.value) {
    return `¥ ${num.toFixed(2)}`;
  }
  const intPart = Math.floor(num);
  const decimalPart = ((num - intPart) * 100).toFixed(0).padStart(2, '0');
  const intStr = String(intPart);
  if (intStr.length <= 1) {
    return `¥ ${intStr}.${decimalPart}`;
  }
  const masked = intStr[0] + '*'.repeat(intStr.length - 1);
  return `¥ ${masked}.${decimalPart}`;
}

// 监听脱敏开关变化并持久化
watch(enableMask, (val) => {
  localStorage.setItem('finance-enableMask', String(val));
});

function toggleMask() {
  enableMask.value = !enableMask.value;
}

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
  if (!isVerified.value) return;
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

function initPage() {
  fetchBillList();
  fetchParkOptions();
}

function onVerificationSuccess() {
  isVerified.value = true;
  sessionStorage.setItem('finance-verified', 'true');
  initPage();
}

function onCancelVerification() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: 'Workspace' });
  message.info('已取消验证，返回首页');
}

watch(
  () => route.fullPath,
  (newPath, oldPath) => {
    if (isDev) return;
    if (newPath !== oldPath) {
      isVerified.value = false;
      sessionStorage.removeItem('finance-verified');
    }
  },
);

onMounted(() => {
  if (isDev) {
    isVerified.value = true;
    sessionStorage.setItem('finance-verified', 'true');
    initPage();
    return;
  }
  const verified = sessionStorage.getItem('finance-verified');
  if (verified === 'true') {
    isVerified.value = true;
    initPage();
    return;
  }
  setTimeout(() => {
    verificationModalRef.value?.open();
  }, 300);
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

async function handleDeleteAll() {
  const verified = await ensureDeleteVerified();
  if (!verified) {
    message.info('已取消手机验证，删除操作未执行');
    return;
  }

  try {
    message.loading({
      content: '正在删除全部财务数据...',
      duration: 0,
      key: 'delete_all_finance_mobile',
    });

    const result = await deleteAllFinance();
    const deletedCount = Number(result?.deletedCount || 0);

    pagination.current = 1;

    message.success({
      content:
        deletedCount > 0
          ? `已删除 ${deletedCount} 条财务记录`
          : '当前没有可删除的财务数据',
      key: 'delete_all_finance_mobile',
    });
    refreshList();
  } catch (error) {
    console.error('批量删除财务记录失败 (mobile):', error);
    message.error({
      content: '批量删除财务记录失败，请稍后重试',
      key: 'delete_all_finance_mobile',
    });
  }
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
  <div class="bg-gray-100 p-2 dark:bg-neutral-900">
    <VbenFormModal @success="handleFormSuccess" />
    <SmsVerificationModal
      ref="verificationModalRef"
      @success="onVerificationSuccess"
      @cancel="onCancelVerification"
    />
    <SmsVerificationModal
      ref="deleteVerificationModalRef"
      title="删除财务验证"
      @success="onDeleteVerificationSuccess"
      @cancel="onDeleteVerificationCancel"
    />

    <template v-if="isVerified">
      <div
        class="search-filters mb-2 rounded bg-white p-3 shadow-sm dark:bg-neutral-800"
      >
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
          <div class="mt-2 flex gap-2">
            <Button type="primary" @click="handleSearch" class="flex-1">
              <Search class="mr-1 h-4 w-4" />
              {{ $t('common.search') }}
            </Button>
            <Button @click="resetSearch" class="flex-1">
              {{ $t('common.reset') }}
            </Button>
          </div>
          <Button danger class="mt-2 w-full" @click="handleDeleteAll">
            删除全部
          </Button>
          <div
            class="mask-toggle mt-2 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-neutral-700 dark:bg-neutral-800"
            role="button"
            tabindex="0"
            @click="toggleMask"
            @keydown.enter.prevent="toggleMask"
            @keydown.space.prevent="toggleMask"
          >
            <div class="flex flex-col gap-0.5">
              <div
                class="text-[15px] font-semibold leading-5 text-gray-800 dark:text-gray-100"
              >
                金额脱敏
              </div>
              <div
                class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
              >
                {{ enableMask ? '已开启，金额将隐藏' : '已关闭，显示完整金额' }}
              </div>
            </div>
            <div class="flex items-center" @click.stop>
              <Switch
                v-model:checked="enableMask"
                checked-children="开"
                un-checked-children="关"
              />
            </div>
          </div>
        </Form>
      </div>

      <Spin :spinning="loading" :tip="$t('ui.loading')">
        <div v-if="bills.length > 0">
          <Card
            v-for="item in bills"
            :key="item.financeId"
            class="mb-3 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-neutral-800"
            :body-style="{ padding: '0' }"
          >
            <div
              class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-neutral-700"
            >
              <span
                class="break-words text-[16px] font-semibold leading-5 text-gray-800 dark:text-gray-100"
              >
                {{ item.billName }}
              </span>
              <div class="flex items-center gap-2">
                <Tag :color="getTagDisplay(item.transactionType).color">
                  {{ getTagDisplay(item.transactionType).text }}
                </Tag>
                <Tag v-if="item.billCategory" color="cyan">
                  {{ item.billCategory }}
                </Tag>
              </div>
            </div>
            <div class="p-4">
              <div class="mb-4 text-center">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  {{ $t('page.finance.amountShort') }}
                </span>
                <p
                  class="text-[21px] font-semibold leading-7"
                  :class="getTransactionTypeClass(item.transactionType)"
                >
                  {{ formatAmount(item.amount) }}
                </p>
              </div>

              <div class="mb-3 grid grid-cols-2 gap-4">
                <div
                  v-if="getParkName(item.parkId)"
                  class="flex flex-col text-left"
                >
                  <span
                    class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                  >
                    {{ $t('page.park.item') }}
                  </span>
                  <span
                    class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                  >
                    {{ getParkName(item.parkId) }}
                  </span>
                </div>
                <div
                  class="flex flex-col text-left"
                  :class="{
                    'col-span-2': !getParkName(item.parkId),
                  }"
                >
                  <span
                    class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                  >
                    {{ $t('page.finance.transactionTime') }}
                  </span>
                  <span
                    class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                  >
                    {{ item.transactionTime }}
                  </span>
                </div>
              </div>
              <p
                v-if="item.remark"
                class="mt-3 rounded-md bg-gray-50 px-3 py-2 text-[14px] leading-relaxed text-gray-600 dark:bg-neutral-700 dark:text-gray-200"
              >
                <span class="mr-1 font-semibold">
                  {{ $t('page.finance.remark') }}:
                </span>
                <span class="whitespace-pre-wrap break-all">{{
                  item.remark
                }}</span>
              </p>
              <div
                v-if="item.images && item.images.length > 0"
                class="mt-4 overflow-hidden rounded-md"
              >
                <Image.PreviewGroup>
                  <Carousel
                    :adaptive-height="true"
                    :dots="item.images.length > 1"
                    :infinite="false"
                  >
                    <Image
                      v-for="image in item.images"
                      :key="image.url"
                      :src="image.url"
                      class="h-auto max-h-[40vh] w-full object-contain"
                    />
                  </Carousel>
                </Image.PreviewGroup>
              </div>
            </div>
            <div
              class="flex justify-center gap-4 border-t border-gray-100 px-4 py-3 dark:border-neutral-700"
            >
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
            class="mt-2 pb-2 text-center"
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
            @click="handleCreate"
            class="!inline-flex !h-14 !w-14 items-center justify-center !p-0 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
          >
            <PlusOutlined class="text-xl" />
          </Button>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.search-filters :deep(.ant-form-item) {
  margin-bottom: 8px;
}

.mask-toggle :deep(.ant-switch) {
  min-width: 52px;
  height: 28px;
}

.mask-toggle :deep(.ant-switch-handle) {
  width: 24px;
  height: 24px;
}

.mask-toggle :deep(.ant-switch-handle::before) {
  border-radius: 50%;
}

.mask-toggle :deep(.ant-switch-inner) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 !important;
  padding-inline: 0 !important;
}

.mask-toggle :deep(.ant-switch-inner-checked),
.mask-toggle :deep(.ant-switch-inner-unchecked) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0 !important;
  line-height: 1;
  text-align: center;
}
</style>
