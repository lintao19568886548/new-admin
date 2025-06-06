<script lang="ts" setup>
import type { AmountBill } from '../data'; // Adjust path as needed

import { computed, ref, watch } from 'vue'; // Import watch

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
// Assuming these API functions exist or will be created
import { $t } from '#/locales';

// Define emits

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
  layout: 'vertical',
  schema: getMobileFormSchema.value, // Rename 'schemas' to 'schema'
  showDefaultActions: false,
});

// Watch relevant fields for total fee calculation
watch(
  async () => {
    // Make watch source async
    const values = await formApi.getValues(); // Use async getValues
    const feeFields: (keyof AmountBill)[] = [
      'eleFee',
      'waterFee',
      'factoryRent',
      'managementFee',
      'garbageFee',
      'serviceFee',
      'invoiceTax',
    ];
    const watchedValues = {} as Pick<AmountBill, (typeof feeFields)[number]>;
    feeFields.forEach((field) => {
      watchedValues[field] = values[field] || 0;
    });
    return watchedValues;
  },
  async () => {
    // Make watch callback async
    await calculateTotalFee(); // Await the async calculation
  },
  { deep: true },
);

async function calculateTotalFee() {
  // Make calculateTotalFee async
  const values = await formApi.getValues(); // Use async getValues
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
    } else if (value === null || value === undefined) {
      total += 0;
    }
  });
  // setValues is synchronous
  formApi.setValues({ totalFee: Number.parseFloat(total.toFixed(2)) });
}

const [Modal, modalApi] = useVbenModal({
  draggable: false,
  onCancel() {
    formApi.resetForm(); // Use resetForm instead of resetFields
    recordId.value = undefined;
    formMode.value = 'create';
  },
  onConfirm: confirm, // Rename 'confirm' to 'onConfirm' and sort alphabetically
  onOpenChange(isOpen) {
    if (isOpen) {
      const modalPayload =
        modalApi.getData<{ data?: AmountBill; mode?: string }>() || {};
      const billData = modalPayload.data;
      const mode = modalPayload.mode;

      if (billData?.billId) {
        recordId.value = billData.billId;
        formMode.value = mode === 'next' ? 'next' : 'edit';
        formApi.setValues({
          ...billData,
          receiptTime: billData.receiptTime
            ? formatDateTime(billData.receiptTime)
            : undefined,
        });
        // Recalculate total on open if editing/next
        calculateTotalFee(); // Call async function (no await needed here unless further actions depend on it)
      } else {
        formMode.value = 'create';
        formApi.resetForm(); // Use resetForm instead of resetFields
        // Set default receiptTime to now for create mode
        formApi.setValues({ receiptTime: formatDateTime(dayjs().valueOf()) }); // Convert Dayjs object to number timestamp
        // Ensure totalFee is calculated/reset for create mode
        calculateTotalFee(); // Call async function
      }
    } else {
      recordId.value = undefined;
    }
  },
  // Remove props from here
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
  modalApi.setData(openParams); // Use setData to pass data, not open
}

defineExpose({ open });
</script>

<template>
  <Modal :title="getModalTitle" :body-style="{ padding: '16px' }" width="95%">
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
