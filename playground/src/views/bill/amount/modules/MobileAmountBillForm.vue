<script lang="ts" setup>
import type { AmountBill } from '../data'; // Adjust path as needed

import { computed, ref, watch } from 'vue'; // Import watch

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createAmountBill, updateAmountBill } from '#/api/bill/amount';
import { $t } from '#/locales';

import { getAmountBillProjectPeriodError } from '../project-period';

const emits = defineEmits<{ success: [] }>();

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
    {
      component: 'Input',
      fieldName: 'projectName',
      label: '项目名称',
      required: true,
    },
    {
      component: 'DatePicker',
      componentProps: { class: 'w-full', valueFormat: 'YYYY-MM-DD HH:mm:ss' },
      fieldName: 'receiptTime',
      label: '收款时间',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'receiptAmount',
      label: '收款金额',
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
    receiptTime: new Date(data.receiptTime as string).toISOString(),
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

const [Modal, modalApi] = useVbenModal({
  draggable: false,
  onCancel() {
    formApi.resetForm();
    recordId.value = undefined;
    formMode.value = 'create';
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues();
    let receiptFields: { receiptAmount: number; receiptTime: null | string };
    try {
      validateBillFields(values);
      receiptFields = normalizeReceiptFields(values);
    } catch (error) {
      message.warning(
        error instanceof Error ? error.message : '请检查账单信息',
      );
      return;
    }

    const submissionData = {
      ...values,
      receiptAmount: receiptFields.receiptAmount,
      receiptTime: receiptFields.receiptTime,
    };

    modalApi.lock();

    try {
      if (recordId.value && formMode.value !== 'next') {
        await updateAmountBill(recordId.value, submissionData);
        message.success(
          $t('ui.actionMessage.updateSuccess', [values?.tenantName ?? '']),
        );
      } else {
        await createAmountBill(submissionData);
        message.success(
          $t('ui.actionMessage.createSuccess', [values?.tenantName ?? '']),
        );
      }
      emits('success');
      modalApi.close();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(
        error?.message ||
          $t('ui.actionMessage.operationFailed', [values?.tenantName ?? '']),
      );
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const modalPayload =
        modalApi.getData<{ data?: AmountBill; mode?: string }>() || {};
      const billData = modalPayload.data;
      const mode = modalPayload.mode;

      if (billData?.billId) {
        recordId.value = billData.billId;
        formMode.value = mode === 'next' ? 'next' : 'edit';
        const isNextMode = mode === 'next';
        const receiptAmount = isNextMode
          ? 0
          : Number(billData.receiptAmount) || 0;
        const receiptTime =
          !isNextMode && billData.receiptTime
            ? formatDateTime(billData.receiptTime)
            : undefined;

        formApi.setValues({
          ...billData,
          receiptAmount,
          receiptTime,
        });
        // Recalculate total on open if editing/next
        calculateTotalFee(); // Call async function (no await needed here unless further actions depend on it)
      } else {
        formMode.value = 'create';
        formApi.resetForm(); // Use resetForm instead of resetFields
        formApi.setValues({ receiptAmount: 0 });
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
  modalApi.setData(openParams);
  modalApi.open();
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
