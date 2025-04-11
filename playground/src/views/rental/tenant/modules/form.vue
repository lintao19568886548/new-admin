<script lang="ts" setup>
import type { RentalManagementItem } from '../types';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';
import dayjs from 'dayjs'; // 添加 dayjs 导入

import { useVbenForm } from '#/adapter/form';
import { createTenant, updateTenant } from '#/api/rental';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<RentalManagementItem>();
const getTitle = computed(() => {
  return formData.value?.rentalTenantId
    ? $t('ui.actionTitle.edit', [$t('system.rental.tenant.item')])
    : $t('ui.actionTitle.create', [$t('system.rental.tenant.item')]);
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
    if (!valid) return;
    const values = await formApi.getValues();

    // 处理日期格式，确保使用本地时间
    if (values.contractDate) {
      values.contractDate = dayjs(values.contractDate).format('YYYY-MM-DD');
    }
    if (values.increaseDate) {
      values.increaseDate = dayjs(values.increaseDate).format('YYYY-MM-DD');
    }

    console.warn('提交表单数据', values);
    modalApi.lock();

    try {
      if (id.value) {
        await updateTenant(id.value, values);
        message.success({
          content: $t('ui.actionMessage.updateSuccess', [values.tenantName]),
        });
      } else {
        await createTenant(values);
        message.success({
          content: $t('ui.actionMessage.createSuccess', [values.tenantName]),
        });
      }
      emit('success');
      modalApi.close();
    } catch (error) {
      console.error('操作失败:', error);
      message.error({
        content: $t('ui.actionMessage.operationFailed', [values.tenantName]),
      });
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<RentalManagementItem>();
      console.warn('打开表单，数据:', data);
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        // 处理日期格式，将UTC时间转换为本地日期
        if (data.contractDate) {
          data.contractDate = dayjs(data.contractDate).format('YYYY-MM-DD');
        }
        if (data.increaseDate) {
          data.increaseDate = dayjs(data.increaseDate).format('YYYY-MM-DD');
        }
        formData.value = data;
        id.value = data.rentalTenantId;
        formApi.setValues(data);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 设置默认值
        formApi.setValues({
          status: '当期',
        } as Partial<RentalManagementItem>);
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
