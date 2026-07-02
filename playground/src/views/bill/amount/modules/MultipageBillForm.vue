<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { AmountBill } from '../data';

import { computed, reactive, ref, shallowRef, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, DatePicker, Input, message, Skeleton } from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createAmountBill,
  getAmountBillDetail,
  updateAmountBill,
} from '#/api/bill';

import { getAmountBillProjectPeriodError } from '../project-period';

/**
 * 多页账单表单配置接口
 */
export interface MultipageBillFormConfig {
  [key: string]: any;
  modalClass?: string;
  modalTitle?: string;
}

// 组件属性定义
const props = defineProps<{
  config?: MultipageBillFormConfig;
  parkOptions?: any[];
  tenantOptions?: any[];
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', data: any): void;
}>();

const isSheetReady = ref(false);
const univerSheetComponent = shallowRef();

const receiptTimeStr = ref<string>('');
const receiptTimeDayjs = ref<Dayjs | null>(null);

// 提取配置值
const config = computed<MultipageBillFormConfig>(() => props.config || {});

const univerSheet = ref<null | {
  dispose: () => void;
  getData: () => Partial<AmountBill>;
  setReceiptTime: (value: null | string) => void;
}>(null);

async function ensureUniverSheetReady() {
  if (!univerSheetComponent.value) {
    const [module] = await Promise.all([
      import('./UniverSheet.vue'),
      import('@univerjs/presets/lib/styles/preset-sheets-core.css'),
    ]);
    univerSheetComponent.value = module.default;
  }
}

// 模态窗口参数
const modalProps = ref({
  class:
    config.value.modalClass ||
    'multipage-bill-form-modal max-w-[90%] w-[1000px]',
  closeOnClickModal: false,
  closeOnPressEscape: false,
  footer: true,
  onClosed: _handleClose,
  showCancelButton: true,
  showConfirmButton: false,
  title: config.value.modalTitle || '账单详情',
});

function shouldKeepCurrentMonthValuesForNextMonth(
  item: Record<string, { originalText: string; value: any }>,
) {
  const meterName = String(
    item.meterName?.originalText ?? item.meterName?.value ?? '',
  );
  return ['公共', '公摊', '电梯用电'].some((keyword) =>
    meterName.includes(keyword),
  );
}

/**
 * 转换水电费项目为下个月的数据格式
 * @param itemsJson - 包含项目数组的JSON字符串
 * @returns 转换后并重新序列化为JSON的字符串
 */
function transformItemsForNextMonth(itemsJson: string | undefined): string {
  if (!itemsJson) {
    return '[]';
  }
  try {
    const items = JSON.parse(itemsJson) as Record<
      string,
      { originalText: string; value: any }
    >[];

    if (!items || items.length === 0) {
      return '[]';
    }
    const newItems = items.map((item) => {
      if (shouldKeepCurrentMonthValuesForNextMonth(item)) {
        return { ...item };
      }

      // 只保留生成新账单所需的基础数据，并重置计算值
      const newItem: Record<string, any> = {
        meterName: item.meterName,
        multiplier: item.multiplier,
        unitPrice: item.unitPrice,
      };

      const prevReading = item.previousReading;
      const currentReading = item.currentReading;

      // 将本月读数赋值给上月读数
      newItem.previousReading = {
        ...prevReading,
        originalText: String(currentReading?.value || 0),
        value: currentReading?.value || 0,
      };
      // 本月读数清零
      newItem.currentReading = {
        ...currentReading,
        originalText: '0',
        value: 0,
      };
      return newItem;
    });
    return JSON.stringify(newItems);
  } catch (error) {
    console.error('Failed to parse or transform items for next month:', error);
    return '[]';
  }
}

function syncReceiptTime(dateStr: null | string) {
  const d = dateStr ? dayjs(dateStr) : null;
  const formatted = d?.isValid() ? d.format('YYYY-MM-DD') : null;
  receiptTimeStr.value = formatted || '';
  receiptTimeDayjs.value = formatted ? dayjs(formatted) : null;
  univerSheet.value?.setReceiptTime(formatted);
}

function onReceiptTextBlur() {
  syncReceiptTime(receiptTimeStr.value.trim() || null);
}

function onReceiptTextChange(e: Event) {
  // allow-clear fires a change event with empty value; blur doesn't fire for clear button
  if (
    (e.target as HTMLInputElement | null)?.value === '' &&
    !receiptTimeStr.value
  ) {
    syncReceiptTime(null);
  }
}

function onReceiptDatePickerChange(date: Dayjs | null | string) {
  const d = typeof date === 'string' ? dayjs(date) : date;
  syncReceiptTime(d?.isValid() ? d.format('YYYY-MM-DD') : null);
}

function onSyncToday() {
  syncReceiptTime(dayjs().format('YYYY-MM-DD'));
}

watch(isSheetReady, (ready) => {
  if (ready) {
    const rt = billData.receiptTime;
    const d = rt ? dayjs(rt) : null;
    receiptTimeStr.value = d?.isValid() ? d.format('YYYY-MM-DD') : '';
    receiptTimeDayjs.value = d?.isValid() ? d : null;
  } else {
    receiptTimeStr.value = '';
    receiptTimeDayjs.value = null;
  }
});

// 关闭处理函数
function _handleClose() {
  delete billData.billId;
  receiptTimeStr.value = '';
  receiptTimeDayjs.value = null;
  univerSheet.value?.dispose();
  modalApi.close();
  emit('close');
}

// 创建模态窗口
const [Modal, modalApi] = useVbenModal(modalProps.value);

// 账单数据
const billData = reactive<AmountBill>({
  eleFee: 0,
  factoryRent: 0,
  garbageFee: 0,
  invoiceTax: 0,
  managementFee: 0,
  serviceFee: 0,
  totalFee: 0,
  waterFee: 0,
});

function normalizeReceiptFields(data: Partial<AmountBill>) {
  const receiptAmount = Number(data.receiptAmount) || 0;

  if (!Number.isFinite(receiptAmount) || receiptAmount < 0) {
    throw new Error('收款金额不能为负数');
  }

  if (receiptAmount === 0) {
    return {
      receiptAmount: 0,
      receiptTime: null,
    };
  }

  if (!data.receiptTime) {
    throw new Error('已填写收款金额时，必须填写收款时间');
  }

  return {
    receiptAmount,
    receiptTime: data.receiptTime,
  };
}

function validateBillFields(data: Partial<AmountBill>) {
  if (!String(data.projectName || '').trim()) {
    throw new Error('项目名称不能为空');
  }
  const projectPeriodError = getAmountBillProjectPeriodError(data.projectName);
  if (projectPeriodError) {
    throw new Error(projectPeriodError);
  }

  if (!data.tenantId && !String(data.tenantName || '').trim()) {
    throw new Error('租户不能为空');
  }

  const totalFee = Number(data.totalFee || 0);
  if (!Number.isFinite(totalFee) || totalFee <= 0) {
    throw new Error('本月收费金额必须大于0');
  }
}

// 保存总表单
async function handleSave() {
  // 从Univer表格中提取水电费明细数据
  const univerData = univerSheet.value?.getData();
  if (univerData) {
    Object.assign(billData, univerData);
  } else {
    message.warning('无法获取账单数据，请重试');
    return;
  }
  // 简化后的数据保存，只保留核心字段
  let receiptFields: { receiptAmount: number; receiptTime: null | string };
  try {
    validateBillFields(billData);
    receiptFields = normalizeReceiptFields(billData);
  } catch (error) {
    message.warning(error instanceof Error ? error.message : '请检查收款信息');
    return;
  }

  const saveData = {
    eleBills: billData.eleBills,
    eleFee: Number(billData.eleFee) || 0,
    eleItem: billData.eleItem,
    extraProjectItem: billData.extraProjectItem,
    factoryRent: Number(billData.factoryRent) || 0,
    garbageFee: Number(billData.garbageFee) || 0,
    invoiceTax: Number(billData.invoiceTax) || 0,
    managementFee: Number(billData.managementFee) || 0,
    parkId: billData.parkId,
    penaltyFee: Number(billData.penaltyFee) || 0,
    privateBankAccount: billData.privateBankAccount,
    projectName: billData.projectName,
    publicBankAccount: billData.publicBankAccount,
    receiptAmount: receiptFields.receiptAmount,
    receiptTime: receiptFields.receiptTime,
    remark: billData.remark,
    serviceFee: Number(billData.serviceFee) || 0,
    tenantId: billData.tenantId,
    tenantName: billData.tenantName,
    totalFee: Number(billData.totalFee) || 0,
    waterBills: billData.waterBills,
    waterFee: Number(billData.waterFee) || 0,
    waterItem: billData.waterItem,
  };

  // 提交数据
  try {
    await (billData.billId
      ? updateAmountBill(billData.billId, saveData)
      : createAmountBill(saveData));
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试');
    return;
  }
  emit('success', { ...saveData });
  _handleClose();
}

async function open(data: AmountBill, options?: { isNextMonth?: boolean }) {
  modalApi.open();
  isSheetReady.value = false;
  await ensureUniverSheetReady();
  // 重置数据
  Object.keys(billData).forEach((key) => {
    delete (billData as any)[key];
  });
  if (data.billId) {
    const detail = await getAmountBillDetail(data.billId);

    if (options?.isNextMonth) {
      // 生成下月账单
      detail.eleItem = transformItemsForNextMonth(detail.eleItem);
      detail.waterItem = transformItemsForNextMonth(detail.waterItem);
      // 清理ID和特定字段，为新账单做准备
      delete detail.billId;
      detail.receiptAmount = 0;
      detail.receiptTime = undefined;
      detail.penaltyFee = 0;
      detail.remark = '';
    }

    Object.assign(billData, detail);
  } else {
    Object.assign(billData, {
      ...data,
      receiptTime: data.receiptTime || undefined,
    });
  }
  isSheetReady.value = true;
}
defineExpose({ open });
</script>

<template>
  <Modal>
    <div class="bill-items-container">
      <h3 class="mb-4 text-lg font-medium">账单详情</h3>
      <div class="receipt-time-bar mb-3 flex items-center gap-2">
        <span class="shrink-0 text-sm font-medium">收款时间：</span>
        <Input
          v-model:value="receiptTimeStr"
          allow-clear
          placeholder="手动输入（如 2025-06-01）"
          style="width: 175px"
          @blur="onReceiptTextBlur"
          @change="onReceiptTextChange"
          @press-enter="onReceiptTextBlur"
        />
        <DatePicker
          :value="receiptTimeDayjs || undefined"
          format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 150px"
          @change="onReceiptDatePickerChange"
        />
        <Button @click="onSyncToday">同步今日</Button>
      </div>

      <div v-if="!isSheetReady" class="sheet-loading-placeholder">
        <Skeleton active :paragraph="{ rows: 10 }" />
      </div>
      <component
        :is="univerSheetComponent"
        v-if="isSheetReady"
        ref="univerSheet"
        :bill-data="billData"
        :park-options="props.parkOptions"
        :tenant-options="props.tenantOptions"
      />
    </div>

    <template #footer>
      <div class="footer-buttons">
        <Button @click="_handleClose">取消</Button>
        <Button type="primary" @click="handleSave">保存</Button>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped>
.bill-items-container {
  padding: 10px 20px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background-color: #fafafa;
}

.sheet-loading-placeholder {
  width: 100%;
  height: 60vh;
  padding: 20px;
}

// 底部按钮样式
.footer-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
