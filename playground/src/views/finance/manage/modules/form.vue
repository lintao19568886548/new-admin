<script lang="ts" setup>
import type { SystemFinanceApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemFinanceApi.SystemFinance>();

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || {});
}

const id = ref();
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    console.warn('提交表单数据', values);
    modalApi.lock();

    // 模拟保存操作
    setTimeout(() => {
      message.success({
        content: id.value
          ? $t('ui.actionMessage.operationSuccess', [values.billName])
          : $t('ui.actionMessage.operationFailed', [values.billName]),
      });
      emits('success');
      modalApi.close();
    }, 1000);
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<SystemFinanceApi.SystemFinance>();
      console.warn('打开表单，数据:', data);
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        formData.value = data;
        id.value = data.id;
        formApi.setValues(data);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 设置默认值
        formApi.setValues({
          transactionTime: new Date().toISOString(),
          transactionType: '支出',
        });
      }
    }
  },
});

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('page.finance.edit')
    : $t('page.finance.create');
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
