<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createAccessBrand, updateAccessBrand } from '#/api/access/brand';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<Record<string, any>>();

const getTitle = computed(() =>
  formData.value?.accessBrandId ? '编辑门禁品牌' : '新增门禁品牌',
);

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
      };
      const recordId = formData.value?.accessBrandId;

      await (recordId
        ? updateAccessBrand(recordId, dataToSubmit)
        : createAccessBrand(dataToSubmit));
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
      : { enabled: true, isDefault: false };
    formApi.resetForm();
    formApi.setValues(formData.value);
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
