<script lang="ts" setup>
import type { FinanceItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils'; // Import for date formatting

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createFinance, updateFinance } from '#/api/finance';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<FinanceItem | undefined>(); // Changed to allow undefined, initialized as undefined

const [Form, formApi] = useVbenForm({
  // Ensure form items are compact for mobile
  baseItemColProps: { span: 24 }, // Makes all form items full width
  labelColProps: { span: 24 },
  layout: 'vertical',
  schema: useFormSchema(), // Reuses the schema from data.ts
  showDefaultActions: false, // Custom actions will be handled by the modal
  wrapperColProps: { span: 24 },
});

function resetForm() {
  formApi.resetForm();
  // For new forms, set default values. For existing, set to original data.
  if (formData.value?.financeId) {
    formApi.setValues(formData.value);
  } else {
    formApi.setValues({
      transactionTime: formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss'), // Default to current time, formatted
      transactionType: '支出', // Default transaction type
    });
  }
}

const id = ref<number | undefined>();

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const values = await formApi.getValues();
    modalApi.lock();

    try {
      // Ensure amount is a number
      values.amount =
        values.amount !== undefined &&
        values.amount !== null &&
        values.amount !== ''
          ? Number(values.amount)
          : 0;

      // Format transactionTime before submission if it exists
      if (values.transactionTime) {
        // Apply the same transformation as the desktop form.vue
        values.transactionTime = new Date(values.transactionTime).toISOString();
      }

      const cleanValues: Partial<FinanceItem> = {};
      Object.entries(values).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          (cleanValues as Record<string, any>)[key] = value;
        }
      });

      if (id.value) {
        await updateFinance(id.value, cleanValues);
        message.success(
          $t('ui.actionMessage.updateSuccess', [values.billName || '']),
        );
      } else {
        await createFinance(cleanValues as FinanceItem); // Ensure type matches API expectation
        message.success(
          $t('ui.actionMessage.createSuccess', [values.billName || '']),
        );
      }
      emits('success');
      modalApi.close();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(
        error?.message ||
          $t('ui.actionMessage.operationFailed', [values.billName || '']),
      );
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<FinanceItem>();
      formApi.resetForm(); // Reset form fields before setting new data
      if (data && data.financeId) {
        id.value = data.financeId;
        formData.value = { ...data };
        formApi.setValues(data);
      } else {
        id.value = undefined;
        formData.value = undefined; // Explicitly set to undefined for new entry
        // Set default values for a new record
        formApi.setValues({
          transactionTime: formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss'),
          transactionType: '支出', // Default transaction type from schema or here
        });
      }
    } else {
      id.value = undefined; // Clear id when modal closes
      formData.value = undefined; // Clear formData when modal closes
    }
  },
  width: '90%', // Mobile-friendly width
});

const getModalTitle = computed(() => {
  return id.value
    ? $t('page.finance.edit') // Assuming $t('page.finance.edit') exists
    : $t('page.finance.create'); // Assuming $t('page.finance.create') exists
});
</script>
<template>
  <Modal :title="getModalTitle" :body-style="{ padding: '16px' }">
    <Form />
    <template #prepend-footer>
      <div style="flex-grow: 1; margin-right: 8px; text-align: left">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style lang="css" scoped>
/* Add any mobile-specific form styling if needed */
:deep(.ant-form-item) {
  margin-bottom: 16px; /* Adjust spacing for mobile */
}
</style>
