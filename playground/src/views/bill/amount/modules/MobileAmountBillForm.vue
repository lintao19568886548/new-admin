<script lang="ts" setup>
import type { AmountBill } from '../data'; // Adjust path as needed

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { createAmountBill, updateAmountBill } from '#/api/bill'; // Assuming these API functions exist or will be created
import { $t } from '#/locales';

// Define emits
const emits = defineEmits(['success']);

const recordId = ref<number | undefined>();
const formMode = ref<'create' | 'edit' | 'next'>('create');

// Simplified form schema for mobile - adapt from AmountBill and existing forms
// This needs to be expanded based on the actual fields of AmountBill required for mobile editing
const getMobileFormSchema = computed(() => {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: '租户名称',
      required: true,
    },
    { component: 'Input', fieldName: 'projectName', label: '项目名称' },
    {
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD HH:mm:ss' },
      fieldName: 'receiptTime',
      label: '收款时间',
      required: true,
    },
    // --- Key numerical fields ---
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'eleFee',
      label: '电费合计',
      required: true,
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'waterFee',
      label: '水费合计',
      required: true,
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'factoryRent',
      label: '厂房租金',
      required: true,
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'managementFee',
      label: '基本管理费',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'garbageFee',
      label: '垃圾管理费',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'serviceFee',
      label: '服务费',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full' },
      fieldName: 'invoiceTax',
      label: '开票税金',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', readonly: true },
      fieldName: 'totalFee',
      label: '总费用',
      required: true,
    }, // Often calculated
    // Add other relevant fields from AmountBill: eleTaxRate, rentTaxRate, etc.
    // Consider if complex nested items like eleBills, waterBills need to be handled here or simplified for mobile.
    { component: 'Textarea', fieldName: 'remark', label: '备注' },
  ];
});

const [Form, formApi] = useVbenForm({
  baseItemColProps: { span: 24 },
  labelColProps: { span: 24 },
  layout: 'vertical',
  schemas: getMobileFormSchema.value,
  showDefaultActions: false,
  wrapperColProps: { span: 24 },
});

function calculateTotalFee() {
  const values = formApi.getValuesSync();
  let total = 0;
  const fieldsToSum: (keyof AmountBill)[] = [
    'eleFee',
    'waterFee',
    'factoryRent',
    'managementFee',
    'garbageFee',
    'serviceFee',
    'invoiceTax',
  ];
  fieldsToSum.forEach((field) => {
    const value = values[field];
    if (value && typeof value === 'number') {
      total += value;
    }
  });
  formApi.setValues({ totalFee: Number.parseFloat(total.toFixed(2)) });
}

const [Modal, modalApi] = useVbenModal({
  draggable: false,
  async onConfirm() {
    const { valid, values } = await formApi.validateAndGetValues();
    if (!valid) return;

    modalApi.lock();
    try {
      const cleanValues: Partial<AmountBill> = {};
      Object.entries(values).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          // Ensure numbers are numbers
          if (
            getMobileFormSchema.value.some(
              (s) => s.fieldName === key && s.component === 'InputNumber',
            )
          ) {
            (cleanValues as Record<string, any>)[key] = Number(value);
          } else {
            (cleanValues as Record<string, any>)[key] = value;
          }
        }
      });
      // Ensure receiptTime is in ISO format if it exists and is a Dayjs object or valid date string
      if (cleanValues.receiptTime) {
        cleanValues.receiptTime = dayjs(cleanValues.receiptTime).toISOString();
      }

      if (formMode.value === 'edit' && recordId.value) {
        await updateAmountBill(recordId.value, cleanValues); // Assumes updateAmountBill exists
        message.success(
          $t('ui.actionMessage.updateSuccess', [values.tenantName || '']),
        );
      } else {
        // 'create' or 'next'
        // For 'next', some fields might be pre-filled from the original bill, others reset (e.g., receiptTime)
        // The createAmountBill API might need to handle this logic or a separate one for 'next'
        await createAmountBill(cleanValues as AmountBill); // Assumes createAmountBill exists
        message.success(
          $t('ui.actionMessage.createSuccess', [values.tenantName || '']),
        );
      }
      emits('success');
      modalApi.close();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(
        error?.message ||
          $t('ui.actionMessage.operationFailed', [values.tenantName || '']),
      );
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      formApi.resetForm();
      const data = modalApi.getData<AmountBill>();
      const mode = modalApi.getData<string>('mode'); // Check if mode is passed for 'next'

      if (data && data.billId && mode !== 'next') {
        // Editing existing
        recordId.value = data.billId;
        formMode.value = 'edit';
        // Dates might need reformatting if API sends ISO but DatePicker expects Dayjs or specific string
        const formData = { ...data };
        if (formData.receiptTime)
          formData.receiptTime = formatDateTime(
            formData.receiptTime,
            'YYYY-MM-DD HH:mm:ss',
          );
        formApi.setValues(formData);
      } else if (data && mode === 'next') {
        // Creating next month's bill based on current
        recordId.value = undefined;
        formMode.value = 'next';
        const nextBillData: Partial<AmountBill> = {
          ...data, // Copy most fields
          billId: undefined, // Clear ID
          eleBills: [], // Reset or carry over selectively
          receiptTime: formatDateTime(
            dayjs().add(1, 'month').startOf('month'),
            'YYYY-MM-DD HH:mm:ss',
          ), // Default to next month
          // other fields like readings might need to be cleared or estimated
          totalFee: 0, // Will be recalculated
          waterBills: [], // Reset or carry over selectively
        };
        formApi.setValues(nextBillData);
        calculateTotalFee(); // Recalculate total based on carried over fees
      } else {
        // Creating new
        recordId.value = undefined;
        formMode.value = 'create';
        formApi.setValues({
          // Set other defaults as needed from AmountBill
          eleFee: 0,
          factoryRent: 0,
          receiptTime: formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss'),
          totalFee: 0,
          waterFee: 0,
        });
      }
      // Add listeners for fee fields to recalculate totalFee
      const feeFieldsToWatch: (keyof AmountBill)[] = [
        'eleFee',
        'waterFee',
        'factoryRent',
        'managementFee',
        'garbageFee',
        'serviceFee',
        'invoiceTax',
      ];
      feeFieldsToWatch.forEach((field) => {
        formApi.watchField(field, calculateTotalFee);
      });
    } else {
      recordId.value = undefined;
      // Clean up watchers if any were manually set up beyond formApi.watchField if it doesn't auto-cleanup
    }
  },
  width: '95%', // Mobile-friendly width
});

const getModalTitle = computed(() => {
  if (formMode.value === 'edit')
    return $t('page.bill.amount.editBill', '编辑总账单');
  if (formMode.value === 'next')
    return $t('page.bill.amount.nextBill', '新增下月总账单');
  return $t('page.bill.amount.createBill', '创建总账单');
});

// Expose the open method for the parent component
function open(data?: AmountBill, mode?: 'next') {
  const openParams: { data?: AmountBill; mode?: string } = {};
  if (data) openParams.data = data;
  if (mode) openParams.mode = mode;
  modalApi.open(openParams);
}

defineExpose({ open });
</script>

<template>
  <Modal :title="getModalTitle" :body-style="{ padding: '16px' }">
    <Form />
    <template #prepend-footer>
      <div style="flex-grow: 1; margin-right: 8px; text-align: left">
        <Button type="default" @click="() => formApi.resetForm()">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style lang="less" scoped>
/* Add any mobile-specific form styling if needed */
:deep(.ant-form-item) {
  margin-bottom: 12px; /* Adjust spacing for mobile */
}
:deep(.ant-picker) {
  width: 100%;
}
</style>
