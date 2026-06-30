<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createRepairOrder, updateRepairOrder } from '#/api/maintenance';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<Record<string, any>>();

const getTitle = computed(() =>
  formData.value?.repairOrderId ? '编辑报修工单' : '新增报修工单',
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

function normalizeSubmitData(rawData: Record<string, any>) {
  const dataToSubmit: Record<string, any> = { ...rawData };
  const cascaderValue = rawData.factoryId;

  if (Array.isArray(cascaderValue)) {
    if (cascaderValue.length >= 2) {
      dataToSubmit.parkId = cascaderValue[0];
      dataToSubmit.factoryId = cascaderValue[cascaderValue.length - 1];
    } else if (cascaderValue.length === 1) {
      dataToSubmit.parkId = cascaderValue[0];
      delete dataToSubmit.factoryId;
    }
  }

  return dataToSubmit;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    modalApi.lock();
    try {
      const rawData = await formApi.getValues();
      const dataToSubmit = normalizeSubmitData(rawData);
      const recordId = formData.value?.repairOrderId;

      await (recordId
        ? updateRepairOrder(recordId, dataToSubmit)
        : createRepairOrder(dataToSubmit));
      modalApi.close();
      emit('success');
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;

    const data = modalApi.getData();
    if (data) {
      formData.value = { ...data };
      formData.value.factoryId =
        data.parkId && data.factoryId ? [data.parkId, data.factoryId] : [];
      formApi.setValues(formData.value);
    } else {
      formData.value = undefined;
      formApi.resetForm();
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
