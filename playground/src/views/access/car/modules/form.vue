<script lang="ts" setup>
import type { CarItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { createCar, updateCar } from '#/api/access/car';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<CarItem>();
const getTitle = computed(() => {
  return formData.value?.carId
    ? $t('ui.actionTitle.edit', [$t('记录')])
    : $t('ui.actionTitle.create', [$t('记录')]);
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

const id = ref();
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      modalApi.lock();
      const values = await formApi.getValues();

      try {
        if (id.value) {
          await updateCar(id.value, values);
          message.success({
            content: $t('ui.actionMessage.updateSuccess', [values.carNumber]),
          });
        } else {
          await createCar(values);
          message.success({
            content: $t('ui.actionMessage.createSuccess', [values.carNumber]),
          });
        }
        modalApi.close();
        emit('success');
      } catch (error) {
        console.error('操作失败:', error);
        message.error({
          content: id.value
            ? $t('ui.actionMessage.updateFailed', [values.carNumber])
            : $t('ui.actionMessage.createFailed', [values.carNumber]),
        });
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<CarItem>();
      console.warn('打开表单，数据:', data);
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        // 创建数据副本，避免修改原始数据
        const formattedData = { ...data };

        // 格式化日期
        if (formattedData.registerTime) {
          formattedData.registerTime = dayjs(formattedData.registerTime).format(
            'YYYY-MM-DD HH:mm:ss',
          );
        }

        formData.value = formattedData;
        id.value = data.carId;
        formApi.setValues(formattedData);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 设置默认值
        formApi.setValues({
          registerTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          status: 1, // 修改字段名从 accessStatus 为 status
        });
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
