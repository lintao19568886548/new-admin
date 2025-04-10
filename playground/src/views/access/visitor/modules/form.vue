<script lang="ts" setup>
import type { VisitorItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { createVisitor, updateVisitor } from '#/api/access/visitor';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<VisitorItem>();
const getTitle = computed(() => {
  return formData.value?.visitorId
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

      // 处理状态值，将字符串转换为数字
      const submitData = { ...values };
      if (submitData.status === '进入') {
        submitData.status = 0;
      } else if (submitData.status === '离开') {
        submitData.status = 1;
      }

      try {
        if (id.value) {
          await updateVisitor(id.value, submitData);
          message.success({
            content: $t('ui.actionMessage.updateSuccess', [values.visitorName]),
          });
        } else {
          await createVisitor(submitData);
          message.success({
            content: $t('ui.actionMessage.createSuccess', [values.visitorName]),
          });
        }
        modalApi.close();
        emit('success');
      } catch (error) {
        console.error('操作失败:', error);
        message.error({
          content: id.value
            ? $t('ui.actionMessage.updateFailed', [values.visitorName])
            : $t('ui.actionMessage.createFailed', [values.visitorName]),
        });
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<VisitorItem>();
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

        // 处理状态值，将数字转换为字符串
        if (formattedData.status === 0) {
          formattedData.status = '进入';
        } else if (formattedData.status === 1) {
          formattedData.status = '离开';
        }

        formData.value = formattedData;
        id.value = data.visitorId;
        formApi.setValues(formattedData);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 设置默认值
        formApi.setValues({
          registerTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          status: '进入',
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
