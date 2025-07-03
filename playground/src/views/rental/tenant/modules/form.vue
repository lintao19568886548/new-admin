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
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-4',
});

function resetForm() {
  formApi.resetForm();
  formApi.setValues(formData.value || {});
}

const id = ref();
const [Modal, modalApi] = useVbenModal({
  class: 'w-[90%] md:w-[70%] lg:w-[60%]',
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();

    // 处理日期格式，确保使用本地时间
    if (values.contractDate) {
      values.contractStart = new Date(values.contractDate[0]).toISOString(); // 转换为ISO字符串，确保正确的时间格式
      values.contractEnd = new Date(values.contractDate[1]).toISOString(); // 转换为ISO字符串，确保正确的时间格式
      delete values.contractDate;
    }
    if (values.increaseData) {
      // 确保increaseData是数组
      if (Array.isArray(values.increaseData)) {
        const increaseData = [];
        for (const item of values.increaseData) {
          if (item.date && item.rate) {
            increaseData.push({
              date: item.date,
              rate: item.rate,
            });
          }
        }
        values.increaseData = JSON.stringify(increaseData);
      } else {
        // 如果不是数组，设置为空数组的JSON字符串
        values.increaseData = '[]';
      }
    } else {
      // 如果不存在，设置为空数组的JSON字符串
      values.increaseData = '[]';
    }

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
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        // 处理日期格式，将UTC时间转换为本地日期
        if (data.contractStart && data.contractEnd) {
          data.contractDate = [
            dayjs(data.contractStart).format('YYYY-MM-DD'),
            dayjs(data.contractEnd).format('YYYY-MM-DD'),
          ];
        }

        // 处理增租数据
        if (data.increaseData) {
          try {
            // 检查increaseData是否已经是对象数组
            let increaseFrom =
              typeof data.increaseData === 'string'
                ? JSON.parse(data.increaseData)
                : data.increaseData;

            // 确保increaseFrom是数组
            if (!Array.isArray(increaseFrom)) {
              increaseFrom = [];
            }

            // 直接设置increaseData为数组，让子组件处理具体的表单项
            data.increaseData = increaseFrom;
          } catch (error) {
            console.error('处理增租数据失败:', error);
            // 出错时设置为空数组，避免后续处理出错
            data.increaseData = [];
          }
        } else {
          // 如果没有增租数据，设置为空数组
          data.increaseData = [];
        }

        // 先设置formData，确保子组件能够访问到数据
        formData.value = { ...data };
        id.value = data.rentalTenantId;

        // 延迟设置表单值，确保子组件有时间初始化
        setTimeout(() => {
          formApi.setValues(data);
        }, 100);
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
