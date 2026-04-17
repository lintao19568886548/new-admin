<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createDoor } from '#/api/access/door';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<Record<string, any>>();
const getTitle = computed(() => $t('ui.actionTitle.create', ['门禁设备']));

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

function resetForm() {
  formApi.resetForm();
  formApi.setValues(
    formData.value || {
      status: 1,
    },
  );
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }

    modalApi.lock();
    const values = await formApi.getValues();
    const payload = {
      deviceCode: String(values.deviceCode ?? '')
        .trim()
        .toUpperCase(),
      deviceName: String(values.deviceName ?? '').trim(),
      location: String(values.location ?? '').trim(),
      parkId: Number(values.parkId),
      status: Number(values.status) as 0 | 1,
    };

    try {
      await createDoor(payload);
      message.success({
        content: $t('ui.actionMessage.createSuccess', [payload.deviceName]),
      });
      modalApi.close();
      emit('success');
    } catch (error) {
      console.error('创建门禁设备失败:', error);
      message.error({
        content: $t('ui.actionMessage.createFailed', [payload.deviceName]),
      });
    } finally {
      modalApi.lock(false);
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      return;
    }

    formApi.resetForm();
    formData.value = {
      status: 1,
    };
    formApi.setValues(formData.value);
  },
});
</script>

<template>
  <Modal :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button danger type="primary" @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
