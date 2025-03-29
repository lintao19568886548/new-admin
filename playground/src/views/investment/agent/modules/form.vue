<script lang="ts" setup>
import type { SystemFinanceApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue'; // 添加 message 导入

import { useVbenForm } from '#/adapter/form';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemFinanceApi.SystemFinance>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    console.warn('提交表单数据', values); // 将 console.log 改为 console.warn
    drawerApi.lock();

    // 模拟保存操作
    setTimeout(() => {
      message.success({
        content: id.value
          ? $t('ui.actionMessage.operationSuccess', [values.billName])
          : $t('ui.actionMessage.operationFailed', [values.billName]),
      });
      emits('success');
      drawerApi.close();
    }, 1000);
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemFinanceApi.SystemFinance>();
      console.warn('打开表单，数据:', data); // 将 console.log 改为 console.warn
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        formData.value = data;
        id.value = data.id;
        formApi.setValues(data);
      } else {
        id.value = undefined;
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
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
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
