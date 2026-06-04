<script lang="ts" setup>
import type { Rule } from 'ant-design-vue/es/form';
import type { Dayjs } from 'dayjs';

import type { AmountBill } from './data';

import { onActivated, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { formatDateTime } from '@vben/utils';

import { PlusOutlined } from '@ant-design/icons-vue';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Pagination,
  Row,
  Select,
  Spin,
  Switch,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  deleteAllAmountBill,
  deleteAmountBill,
  getAmountBillList,
} from '#/api/bill';
import { getVisitorParkList as fetchParks } from '#/api/park';
import MobileDateRange from '#/components/MobileDateRange.vue';
import SmsVerificationModal from '#/components/SmsVerificationModal.vue';
import { useSmsActionVerification } from '#/hooks/useSmsActionVerification';
import { $t } from '#/locales';

import MobileAmountBillForm from './modules/MobileAmountBillForm.vue';

const router = useRouter();
const route = useRoute();

const bills = ref<AmountBill[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});
const loading = ref(false);

const currentParkId = ref<number | undefined>(undefined);
const parkOptions = ref<{ label: string; value: number }[]>([]);

const mobileBillFormRef = ref();

const enableMask = ref(localStorage.getItem('bill-enableMask') !== 'false');

const verificationModalRef = ref<InstanceType<typeof SmsVerificationModal>>();
const deleteVerificationModalRef =
  ref<InstanceType<typeof SmsVerificationModal>>();
const isVerified = ref(false);
const VERIFIED_KEY = 'bill-amount-verified';
const DELETE_VERIFY_STORAGE_KEY = 'bill-delete-verified-at';
const isDev = import.meta.env.DEV;

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

function runDeleteWithVerification(action: () => Promise<void>) {
  window.setTimeout(() => {
    void (async () => {
      const verified = await ensureDeleteVerified();
      if (!verified) {
        message.info('已取消手机验证，删除操作未执行');
        return;
      }

      await action();
    })();
  }, 0);
}

function ensureVerification() {
  if (isDev) {
    isVerified.value = true;
    sessionStorage.setItem(VERIFIED_KEY, 'true');
    initPage();
    return;
  }
  const verified = sessionStorage.getItem(VERIFIED_KEY) === 'true';
  if (verified) {
    isVerified.value = true;
    initPage();
    return;
  }
  isVerified.value = false;
  setTimeout(() => {
    verificationModalRef.value?.open();
  }, 0);
}

const formatFee = (value?: number | string) => {
  const numValue = Number(value);
  if (Number.isNaN(numValue)) return '0.00 元';
  if (!enableMask.value) {
    return `${numValue.toFixed(2)} 元`;
  }
  const intPart = Math.floor(numValue);
  const decimalPart = ((numValue - intPart) * 100).toFixed(0).padStart(2, '0');
  const intStr = String(intPart);
  if (intStr.length <= 1) {
    return `¥${intStr}.${decimalPart} 元`;
  }
  const masked = intStr[0] + '*'.repeat(intStr.length - 1);
  return `¥${masked}.${decimalPart} 元`;
};

watch(enableMask, (val) => {
  localStorage.setItem('bill-enableMask', String(val));
});

function toggleMask() {
  enableMask.value = !enableMask.value;
}

function getFeeDisplay(value: unknown) {
  const num = Number(value);
  if (Number.isFinite(num) && !Number.isNaN(num)) return formatFee(num);
  if (value === null || value === undefined) return '-';
  const text = String(value).trim();
  return text === '' ? '-' : text;
}

function parseProjectAmountItem(item: AmountBill) {
  const raw =
    (item as any).project_amount_item ??
    (item as any).projectAmountItem ??
    (item as any).extra_project_item ??
    item.extraProjectItem ??
    (item as any).projectAmount ??
    (item as any).project_amount;

  if (!raw) return [];

  let parsed: any = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((it) => {
      const label =
        it?.itemName ??
        it?.item_name ??
        it?.name ??
        it?.label ??
        it?.title ??
        it?.projectName;
      const value =
        it?.value ?? it?.amount ?? it?.fee ?? it?.money ?? it?.total ?? it;
      if (label === undefined || label === null) return null;
      return { label: String(label), value };
    })
    .filter(Boolean) as Array<{ label: string; value: unknown }>;
}

function getFeeItems(item: AmountBill) {
  const parsed = parseProjectAmountItem(item);
  if (parsed.length > 0) return parsed;
  return [
    { label: '电费', value: item.eleFee },
    { label: '水费', value: item.waterFee },
    { label: '厂房租金', value: item.factoryRent },
    { label: '基本管理费', value: item.managementFee },
    { label: '垃圾管理费', value: item.garbageFee },
    { label: '服务费', value: item.serviceFee },
    { label: '开票税金', value: item.invoiceTax },
    { label: '滞纳金', value: (item as any).penaltyFee },
  ].filter((x) => x.value !== undefined && x.value !== null);
}

const receiptRange = ref<[Dayjs | undefined, Dayjs | undefined]>([
  undefined,
  undefined,
]);

const searchForm = reactive<{
  projectName: string;
  tenantName: string;
}>({
  projectName: '',
  tenantName: '',
});

async function fetchBillList() {
  if (!isVerified.value) return;
  if (loading.value) return;
  loading.value = true;

  try {
    const startDate = receiptRange.value?.[0]?.format('YYYY-MM-DD');
    const endDate = receiptRange.value?.[1]?.format('YYYY-MM-DD');
    const startTime = startDate ? `${startDate} 00:00:00` : undefined;
    const endTime = endDate ? `${endDate} 23:59:59` : undefined;

    const params = {
      ...searchForm,
      currentPage: pagination.current,
      currentPark: currentParkId.value ?? -1,
      endTime,
      pageSize: pagination.pageSize,
      startTime,
    };

    const result = await getAmountBillList(params);

    if (result && result.items && typeof result.total === 'number') {
      bills.value = result.items;
      pagination.total = result.total;
    } else {
      console.warn(
        'API 返回的数据结构不符合预期或缺少必要字段 (items, total):',
        result,
      );
      message.warn('获取账单列表失败，数据结构异常。');
      bills.value = [];
      pagination.total = 0;
    }
  } catch (error: any) {
    console.error('获取账单列表失败 (mobile):', error);
    message.error(error?.message || '获取账单列表失败');
  } finally {
    loading.value = false;
  }
}

function initPage() {
  fetchBillList();
  fetchParks()
    .then((parks) => {
      parkOptions.value = parks.map((park: any) => ({
        label: park.parkName,
        value: park.parkId,
      }));
    })
    .catch((error) => console.error(error));
}

function onVerificationSuccess() {
  isVerified.value = true;
  sessionStorage.setItem(VERIFIED_KEY, 'true');
  initPage();
}

function onCancelVerification() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push({ name: 'Workspace' });
  message.info('已取消验证，返回上一级');
}

watch(
  () => route.fullPath,
  (newPath, oldPath) => {
    if (isDev) return;
    if (newPath !== oldPath) {
      isVerified.value = false;
      sessionStorage.removeItem(VERIFIED_KEY);
    }
  },
);

onMounted(() => {
  ensureVerification();
});

onActivated(() => {
  ensureVerification();
});

function handleCreate() {
  const newBill: AmountBill = {
    eleBills: [],
    eleFee: 0,
    factoryRent: 0,
    garbageFee: 0,
    invoiceTax: 0,
    managementFee: 0,
    receiptTime: dayjs().toISOString(),
    serviceFee: 0,
    tenantName: '',
    totalFee: 0,
    waterBills: [],
    waterFee: 0,
  };
  mobileBillFormRef.value?.open(newBill);
}

const printModalVisible = ref(false);
const printFormRef = ref();
const currentPrintingBillId = ref<number | string | undefined>(undefined);
const printFormData = ref({
  accountType: [] as string[],
  billingDate: dayjs(),
  cutoffDate: dayjs().add(10, 'day'),
});

const printFormRules: Record<string, Rule[]> = {
  billingDate: [
    { message: '请选择制单日期', required: true, trigger: 'change' },
  ],
  cutoffDate: [
    { message: '请选择停止供水供电时间', required: true, trigger: 'change' },
  ],
};

function handlePrint(item: AmountBill) {
  currentPrintingBillId.value = item.billId;
  printFormData.value.accountType = [];
  printModalVisible.value = true;
}

async function handlePrintOk() {
  try {
    await printFormRef.value?.validate();

    const formData = printFormData.value;
    const printSettings = {
      accountType: formData.accountType,
      billingDate: dayjs(formData.billingDate).format('YYYY-MM-DD'),
      cutoffDate: dayjs(formData.cutoffDate).format('YYYY-MM-DD HH:00:00'),
    };

    const routeData = router.resolve({
      path: `/bill/print/${currentPrintingBillId.value}`,
      query: { ...printSettings },
    });
    window.open(routeData.href, '_blank');
    printModalVisible.value = false;
  } catch (error) {
    console.error(error);
    message.error('请检查表单输入项！');
  }
}

function handlePrintCancel() {
  printModalVisible.value = false;
}

function handleFormSuccess() {
  fetchBillList();
}

async function handleDelete(item: AmountBill) {
  const billDisplayName = item.tenantName || item.projectName || '该账单';

  Modal.confirm({
    cancelText: $t('common.cancel'),
    centered: true,
    content: $t('ui.actionMessage.deleteConfirm', [billDisplayName]),
    okText: $t('common.confirm'),
    okType: 'danger',
    onOk() {
      void executeDelete(item);
    },
    title: '确认删除账单',
  });
}

async function executeDelete(item: AmountBill) {
  const billDisplayName = item.tenantName || item.projectName || '该账单';

  if (!item.billId) return;

  try {
    message.loading({
      content: $t('ui.actionMessage.deleting', [billDisplayName]),
      duration: 0,
      key: 'action_process_msg',
    });

    await deleteAmountBill(item.billId);

    if (bills.value.length === 1 && pagination.current > 1) {
      pagination.current -= 1;
    }

    message.success({
      content: $t('ui.actionMessage.deleteSuccess', [billDisplayName]),
      key: 'action_process_msg',
    });
    fetchBillList();
  } catch (error) {
    console.error('删除账单失败 (mobile):', error);
    message.error({
      content: $t('ui.actionMessage.deleteFailed', [billDisplayName]),
      key: 'action_process_msg',
    });
  }
}

async function handleDeleteAll() {
  runDeleteWithVerification(async () => {
    try {
      message.loading({
        content: '正在删除全部账单数据...',
        duration: 0,
        key: 'delete_all_bill_mobile',
      });

      const result = await deleteAllAmountBill();
      const deletedCount = Number(result?.deletedBillCount || 0);

      pagination.current = 1;

      message.success({
        content:
          deletedCount > 0
            ? `已删除 ${deletedCount} 条账单`
            : '当前没有可删除的账单数据',
        key: 'delete_all_bill_mobile',
      });
      fetchBillList();
    } catch (error) {
      console.error('删除全部账单失败 (mobile):', error);
      message.error({
        content: '删除全部账单失败，请稍后重试',
        key: 'delete_all_bill_mobile',
      });
    }
  });
}

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
  receiptRange.value = [undefined, undefined];
  searchForm.projectName = '';
  searchForm.tenantName = '';
  currentParkId.value = undefined;
  handleSearch();
}
</script>

<template>
  <div class="bg-gray-100 p-2 dark:bg-neutral-900">
    <SmsVerificationModal
      ref="verificationModalRef"
      @success="onVerificationSuccess"
      @cancel="onCancelVerification"
    />
    <SmsVerificationModal
      ref="deleteVerificationModalRef"
      title="删除账单验证"
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
                  v-model:value="currentParkId"
                  :options="parkOptions"
                  allow-clear
                  :placeholder="$t('page.common.selectPark')"
                  @change="handleSearch"
                />
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item label="租户名称">
                <Input
                  v-model:value="searchForm.tenantName"
                  placeholder="请输入租户名称"
                  allow-clear
                />
              </Form.Item>
            </Col>
            <Col :span="12">
              <Form.Item label="项目名称">
                <Input
                  v-model:value="searchForm.projectName"
                  placeholder="请输入项目名称"
                  allow-clear
                />
              </Form.Item>
            </Col>
            <Col :span="24">
              <Form.Item label="收款时间">
                <MobileDateRange v-model:value="receiptRange" />
              </Form.Item>
            </Col>
          </Row>
          <div class="mt-2 flex gap-2">
            <Button type="primary" @click="handleSearch" class="flex-1">
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
            :key="item.billId"
            class="mb-3 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-neutral-800"
            :body-style="{ padding: '0' }"
          >
            <div
              class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-neutral-700"
            >
              <span
                class="break-words text-[16px] font-semibold leading-5 text-gray-800 dark:text-gray-100"
              >
                {{ item.projectName || '未填写项目名称' }}
              </span>
            </div>
            <div class="p-4">
              <div class="mb-4 text-center">
                <span
                  class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                >
                  总费用
                </span>
                <p class="text-[21px] font-semibold leading-7 text-red-500">
                  {{ formatFee(item.totalFee) }}
                </p>
              </div>

              <div class="mb-3 grid grid-cols-2 gap-4">
                <div
                  class="flex flex-col text-left"
                  :class="{ 'col-span-2': !item.receiptTime }"
                >
                  <span
                    class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                  >
                    租户名称
                  </span>
                  <span
                    class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                  >
                    {{ item.tenantName }}
                  </span>
                </div>
                <div v-if="item.receiptTime" class="flex flex-col text-left">
                  <span
                    class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                  >
                    收款时间
                  </span>
                  <span
                    class="text-[14px] leading-5 text-gray-800 dark:text-gray-100"
                  >
                    {{ formatDateTime(item.receiptTime) }}
                  </span>
                </div>
                <div class="col-span-2 flex flex-col text-left">
                  <span
                    class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                  >
                    费用明细
                  </span>
                  <div class="mt-1 space-y-1">
                    <div
                      v-for="fee in getFeeItems(item)"
                      :key="fee.label"
                      class="flex items-center justify-between gap-3 text-[14px] leading-5"
                    >
                      <span
                        class="text-[13px] leading-5 text-gray-500 dark:text-gray-400"
                      >
                        {{ fee.label }}
                      </span>
                      <span
                        class="text-[14px] text-gray-800 dark:text-gray-100"
                      >
                        {{ getFeeDisplay(fee.value) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p
                v-if="item.remark"
                class="mt-3 rounded-md bg-gray-50 px-3 py-2 text-[14px] leading-relaxed text-gray-600 dark:bg-neutral-700 dark:text-gray-200"
              >
                <span class="mr-1 font-semibold">备注:</span>
                <span class="whitespace-pre-wrap break-all">{{
                  item.remark
                }}</span>
              </p>
            </div>

            <div
              class="flex justify-center gap-3 border-t border-gray-100 px-4 py-3 dark:border-neutral-700"
            >
              <Button type="primary" @click="handlePrint(item)">查看</Button>
              <Button danger ghost @click="handleDelete(item)">删除</Button>
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
          v-if="!loading && bills.length === 0"
          class="py-10"
          description="暂无账单数据"
        />
      </Spin>

      <!-- 打印设置模态框 -->
      <Modal
        v-model:open="printModalVisible"
        :title="$t('page.bill.amount.printSettingsTitle', '打印设置')"
        @ok="handlePrintOk"
        @cancel="handlePrintCancel"
        :mask-closable="false"
        width="90%"
        :body-style="{ padding: '16px' }"
      >
        <Form
          ref="printFormRef"
          :model="printFormData"
          :rules="printFormRules"
          layout="vertical"
        >
          <Form.Item label="水电停供时间" name="cutoffDate">
            <DatePicker
              v-model:value="printFormData.cutoffDate"
              :show-time="{ format: 'HH' }"
              format="YYYY-MM-DD HH"
              value-format="YYYY-MM-DD HH:00:00"
              class="w-full"
            />
          </Form.Item>
          <Form.Item label="制单日期" name="billingDate">
            <DatePicker
              v-model:value="printFormData.billingDate"
              value-format="YYYY-MM-DD"
              class="w-full"
            />
          </Form.Item>
          <Form.Item label="账户类型" name="accountType">
            <Checkbox.Group v-model:value="printFormData.accountType">
              <Checkbox value="public">对公账户</Checkbox>
              <Checkbox value="private">对私账户</Checkbox>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      <!-- 手机端表单和详情组件的引用 -->
      <MobileAmountBillForm
        ref="mobileBillFormRef"
        @success="handleFormSuccess"
      />
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

<style lang="less" scoped>
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
  line-height: 1;
  text-align: center;
  width: 100%;
  margin: 0 !important;
}
</style>
