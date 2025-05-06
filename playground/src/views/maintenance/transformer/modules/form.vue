<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createTransformer, updateTransformer } from '#/api/maintenance';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref();
const getTitle = computed(() => {
  return formData.value?.transformerId
    ? $t('ui.actionTitle.edit', [$t('page.maintenance.title')])
    : $t('ui.actionTitle.create', [$t('page.maintenance.title')]);
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
    if (valid) {
      modalApi.lock();
      const data = await formApi.getValues();
      const { transformerId } = modalApi.getData();
      try {
        if (data.checkTime) {
          data.checkTime = new Date(data.checkTime).toISOString();
        }

        await (transformerId
          ? updateTransformer(transformerId, data)
          : createTransformer(data));
        modalApi.close();
        emit('success');
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData();
      if (data) {
        formData.value = data;
        formApi.setValues(formData.value);
      } else {
        formData.value = undefined;
        formApi.resetForm();
      }
    }
  },
});
</script>

<template>
  <Modal :title="getTitle">
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
