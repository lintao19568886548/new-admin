<script lang="ts" setup>
import type { AmountBill } from '../data';

import { computed, reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message, Skeleton } from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createAmountBill,
  getAmountBillDetail,
  updateAmountBill,
} from '#/api/bill';

import UniverSheet from './UniverSheet.vue';

import '@univerjs/presets/lib/styles/preset-sheets-core.css';

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
}>();

// 定义事件
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', data: any): void;
}>();

const isSheetReady = ref(false);

// 提取配置值
const config = computed<MultipageBillFormConfig>(() => props.config || {});

const univerSheet = ref<InstanceType<typeof UniverSheet> | null>(null);

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

// 关闭处理函数
function _handleClose() {
  delete billData.billId;
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
  receiptTime: dayjs().toISOString(),
  serviceFee: 0,
  totalFee: 0,
  waterFee: 0,
});

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
    receiptAmount: Number(billData.receiptAmount) || 0,
    receiptTime: billData.receiptTime,
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
  await (billData.billId
    ? updateAmountBill(billData.billId, saveData)
    : createAmountBill(saveData));
  emit('success', { ...saveData });
  _handleClose();
}

async function open(data: AmountBill, options?: { isNextMonth?: boolean }) {
  modalApi.open();
  isSheetReady.value = false;
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
      detail.receiptTime = dayjs().toISOString();
      detail.penaltyFee = 0;
      detail.remark = '';
    }

    Object.assign(billData, detail);
  } else {
    Object.assign(billData, {
      ...data,
      receiptTime: data.receiptTime || dayjs().toISOString(), // 新账单默认日期，优先使用传入值
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
      <div v-if="!isSheetReady" class="sheet-loading-placeholder">
        <Skeleton active :paragraph="{ rows: 10 }" />
      </div>
      <UniverSheet
        v-if="isSheetReady"
        ref="univerSheet"
        :bill-data="billData"
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
