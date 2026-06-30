<script lang="ts" setup>
import type { MeterType } from '#/api/smart-meter';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createMeterBrand, updateMeterBrand } from '#/api/smart-meter';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<Record<string, any>>();

const getTitle = computed(() => {
  const meterType = formData.value?.meterType as MeterType | undefined;
  const label = meterType === 'water' ? '水表品牌' : '电表品牌';
  return formData.value?.meterBrandId ? `编辑${label}` : `新增${label}`;
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || {});
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    modalApi.lock();
    try {
      const rawData = await formApi.getValues();
      const dataToSubmit = {
        ...rawData,
        brandCode: String(rawData.brandCode || '')
          .trim()
          .toUpperCase(),
        brandName: String(rawData.brandName || '').trim(),
        meterType: formData.value?.meterType,
      };
      const recordId = formData.value?.meterBrandId;

      await (recordId
        ? updateMeterBrand(recordId, dataToSubmit)
        : createMeterBrand(dataToSubmit));
      modalApi.close();
      emit('success');
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = modalApi.getData();
    formData.value = data
      ? { enabled: true, isDefault: false, ...data }
      : undefined;
    formApi.resetForm();
    if (formData.value) {
      formApi.setValues(formData.value);
    }
  },
});
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm"> 重置 </Button>
      </div>
    </template>
  </Modal>
</template>
