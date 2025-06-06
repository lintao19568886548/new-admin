<script lang="ts" setup>
import type { FinanceItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

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
    const { valid, values } = await formApi.validateAndGetValues();
    if (!valid) return;

    const cleanValues = Object.fromEntries(
      Object.entries(values).filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
      ),
    );

    if (cleanValues.amount) {
      cleanValues.amount = Number(cleanValues.amount);
    }

    if (cleanValues.transactionTime) {
      cleanValues.transactionTime = new Date(
        cleanValues.transactionTime as string,
      ).toISOString();
    }

    modalApi.lock();

    try {
      if (recordId.value) {
        await updateFinance(recordId.value, cleanValues);
        message.success(
          $t('ui.actionMessage.updateSuccess', [values.billName]),
        );
      } else {
        await createFinance(cleanValues as FinanceItem);
        message.success(
          $t('ui.actionMessage.createSuccess', [values.billName]),
        );
      }
      emits('success');
      modalApi.close();
    } catch (error: any) {
      console.error('操作失败:', error);
      message.error(
        error?.message ||
          $t('ui.actionMessage.operationFailed', [values.billName]),
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
          transactionTime: formatDateTime(dayjs()),
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
