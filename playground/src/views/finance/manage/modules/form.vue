<script lang="ts" setup>
import type { FinanceItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createFinance, updateFinance } from '#/api/finance';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const recordId = ref<number | string | undefined>();

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

function resetForm() {
  formApi.resetForm();
  // Since we only store the id, we need to handle resetting to initial edit data differently
  // For now, resetForm clears it, which is acceptable for this flow.
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid, values } = await formApi.validate();
    if (!valid) return;

    // Use getValues to ensure we get the latest form data
    const latestValues = (await formApi.getValues()) as FinanceItem;

    const submissionData = {
      ...values,
      ...latestValues,
      amount: Number(latestValues.amount) || 0,
      transactionTime: latestValues.transactionTime
        ? new Date(latestValues.transactionTime as string).toISOString()
        : new Date().toISOString(),
    };

    modalApi.lock();

    try {
      if (recordId.value) {
        await updateFinance(Number(recordId.value), submissionData);
        message.success(
          $t('ui.actionMessage.updateSuccess', [values?.billName ?? '']),
        );
      } else {
        await createFinance(submissionData as unknown as FinanceItem);
        message.success(
          $t('ui.actionMessage.createSuccess', [values?.billName ?? '']),
        );
      }
      emits('success');
      modalApi.close();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(
        error?.message ||
          $t('ui.actionMessage.operationFailed', [values?.billName ?? '']),
      );
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<FinanceItem>();
      formApi.resetForm();
      if (data && data.financeId) {
        recordId.value = data.financeId;
        formApi.setValues(data);
      } else {
        recordId.value = undefined;
        formApi.setValues({
          billCategory: '其他费用',
          billName: '',
          transactionTime: new Date().toISOString(),
          transactionType: '支出',
        });
      }
    }
  },
});

const getDrawerTitle = computed(() => {
  return recordId.value ? $t('page.finance.edit') : $t('page.finance.create');
});
</script>
<template>
  <Modal :title="getDrawerTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
<style lang="css" scoped>
:deep(.ant-tree-title) {
  .tree-actions {
    display: none;
    margin-left: 20px;
  }
}

:deep(.ant-tree-title:hover) {
  .tree-actions {
    display: flex;
    flex: auto;
    justify-content: flex-end;
    margin-left: 20px;
  }
}
</style>
