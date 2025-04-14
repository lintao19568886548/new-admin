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

const formData = ref<FinanceItem>();

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

    // 确保金额是数字类型
    if (values.amount !== undefined && values.amount !== null) {
      values.amount = Number(values.amount);
    }

    console.warn('提交表单数据', values);
    modalApi.lock();

    try {
      // 根据是否有ID判断是创建还是更新
      if (id.value) {
        // 更新财务记录
        await updateFinance(id.value, values);
        message.success({
          content: $t('ui.actionMessage.updateSuccess', [values.billName]),
        });
      } else {
        // 创建财务记录
        await createFinance(values);
        message.success({
          content: $t('ui.actionMessage.createSuccess', [values.billName]),
        });
      }
      emits('success');
      modalApi.close();
    } catch (error) {
      console.error('操作失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [values.billName]),
      });
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<FinanceItem>();
      console.warn('打开表单，数据:', data);
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        formData.value = data;
        id.value = data.financeId; // 使用financeId作为主键
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
  return formData.value?.financeId
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
