<script lang="ts" setup>
import type { RentalManagementItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs'; // 添加 dayjs 导入

import { useVbenForm } from '#/adapter/form';
import { createManage, updateManage } from '#/api/rental';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<RentalManagementItem>();
const getTitle = computed(() => {
  return formData.value?.rentalManageId
    ? $t('ui.actionTitle.edit', [$t('system.rental.name')])
    : $t('ui.actionTitle.create', [$t('system.rental.name')]);
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

      // 处理日期格式，确保使用本地时间
      if (values.createTime) {
        values.createTime = dayjs(values.createTime).format('YYYY-MM-DD');
      }

      try {
        if (id.value) {
          await updateManage(id.value, values);
          message.success({
            content: $t('ui.actionMessage.updateSuccess', [values.title]),
          });
        } else {
          await createManage(values);
          message.success({
            content: $t('ui.actionMessage.createSuccess', [values.title]),
          });
        }
        modalApi.close();
        emit('success');
      } catch (error) {
        console.error('操作失败:', error);
        message.error({
          content: id.value
            ? $t('ui.actionMessage.updateFailed', [values.title])
            : $t('ui.actionMessage.createFailed', [values.title]),
        });
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<RentalManagementItem>();
      console.warn('打开表单，数据:', data);
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        // 处理日期格式，将UTC时间转换为本地日期
        if (data.createTime) {
          data.createTime = dayjs(data.createTime).format('YYYY-MM-DD');
        }

        formData.value = data;
        id.value = data.rentalManageId;
        formApi.setValues(data);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 不设置默认值
        formApi.setValues({} as Partial<RentalManagementItem>);
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
