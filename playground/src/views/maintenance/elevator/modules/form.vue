<script lang="ts" setup>
import { computed, ref } from 'vue'; // <-- 新增导入 onMounted

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createElevator, updateElevator } from '#/api/maintenance';
import { $t } from '#/locales';

import { useFormSchema } from '../data'; // <-- 新增导入 getParkFactoryCascaderOptions

const emit = defineEmits(['success']);
const formData = ref();
const getTitle = computed(() => {
  return formData.value?.id
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
      const rawData = await formApi.getValues();
      const dataToSubmit = { ...rawData };

      // 从 Cascader 的数组值中提取 parkId 和 factoryId
      const cascaderValue = rawData.factoryId;
      if (cascaderValue && Array.isArray(cascaderValue)) {
        if (cascaderValue.length === 2) {
          dataToSubmit.parkId = cascaderValue[0];
          dataToSubmit.factoryId = cascaderValue[1];
        } else if (cascaderValue.length === 1) {
          // 如果只选择了一个层级（例如，如果 changeOnSelect 为 true）
          // 这里根据实际需求处理，当前配置 changeOnSelect: false，应总是有两个值或为空
          dataToSubmit.factoryId = cascaderValue[0]; // 或者根据情况设置 parkId
        } else {
          // 清除或设置默认值，如果选择不完整
          delete dataToSubmit.factoryId;
          delete dataToSubmit.parkId;
        }
      }

      const { elevatorId: recordIdToUpdate } = modalApi.getData();
      try {
        if (dataToSubmit.checkTime) {
          dataToSubmit.checkTime = new Date(
            dataToSubmit.checkTime,
          ).toISOString();
        }

        await (recordIdToUpdate
          ? updateElevator(recordIdToUpdate, dataToSubmit)
          : createElevator(dataToSubmit));
        modalApi.close();
        emit('success');
      } finally {
        modalApi.lock(false);
      }
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData(); // 编辑时的数据
      if (data) {
        formData.value = { ...data };
        // 为 Cascader 准备初始值：[parkId, factoryId]
        data.parkId && data.factoryId
          ? (formData.value.factoryId = [data.parkId, data.factoryId])
          : (formData.value.factoryId = []); // 如果没有，则为空数组
        formApi.setValues(formData.value);
      } else {
        formData.value = undefined;
        formApi.resetForm(); // 新增时重置表单
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
