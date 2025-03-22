<script lang="ts" setup>
import type { WaterItem } from '../data';

import { computed, ref, watch } from 'vue';

import { useVbenDrawer, useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);

const formData = ref<WaterItem>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    // const values = await formApi.getValues();
    drawerApi.lock();

    // 模拟API请求
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      emit('success');
      drawerApi.close();
    } catch {
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<WaterItem>();
      formApi.resetForm();
      if (data) {
        formData.value = data;
        id.value = data.id;
        formApi.setValues(data);
      } else {
        id.value = undefined;
        // 设置默认值
        formApi.setValues({
          multiplier: 1,
        });
      }
    }
  },
});

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['水费账单'])
    : $t('ui.actionTitle.create', ['水费账单']);
});

// 监听水表读数变化，自动计算水费
watch(
  () => [
    formApi.form.values?.lastMonthReading,
    formApi.form.values?.currentMonthReading,
    formApi.form.values?.multiplier,
    formApi.form.values?.unitPrice,
  ],
  ([lastReading, currentReading, multiplier, unitPrice]) => {
    if (lastReading !== null && currentReading !== null) {
      const monthlyUsage = Math.max(0, currentReading - lastReading);
      formApi.setFieldValue('monthlyUsage', monthlyUsage);

      if (multiplier !== null) {
        const actualUsage = monthlyUsage * multiplier;
        formApi.setFieldValue('actualUsage', actualUsage);

        if (unitPrice !== null) {
          const amount = actualUsage * unitPrice;
          formApi.setFieldValue('amount', amount);
        }
      }
    }
  },
  { deep: true },
);

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || { multiplier: 1 });
}

const [Modal, modalApi] = useVbenModal({
  cancelText: '取消',
  onCancel() {
    modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      modalApi.lock();
      try {
        // 模拟API请求
        await new Promise((resolve) => setTimeout(resolve, 1000));
        modalApi.close();
        emit('success');
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<WaterItem>();
      if (data) {
        formData.value = data;
        formApi.setValues(formData.value);
      } else {
        formData.value = undefined;
        formApi.resetForm();
        // 设置默认值
        formApi.setValues({
          multiplier: 1,
        });
      }
    }
  },
  showCancelButton: true,
  showConfirmButton: true,
});
</script>

<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
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
