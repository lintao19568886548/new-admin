<script lang="ts" setup>
import { computed, ref } from 'vue'; // <-- 新增导入 onMounted

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
// 修改: 导入新的 API 函数
import { createHygieneCheck, updateHygieneCheck } from '#/api/maintenance';
import { $t } from '#/locales';

import { useFormSchema } from '../data'; // <-- 新增导入 getParkFactoryCascaderOptions

const emit = defineEmits(['success']);
const formData = ref();
const getTitle = computed(() => {
  return formData.value?.hygieneCheckId // 修改: id -> hygieneCheckId (假设后端主键是 hygieneCheckId)
    ? $t('ui.actionTitle.edit', [$t('page.maintenance.hygieneCheck')])
    : $t('ui.actionTitle.create', [$t('page.maintenance.hygieneCheck')]);
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
          dataToSubmit.factoryId = cascaderValue[0];
        } else {
          delete dataToSubmit.factoryId;
          delete dataToSubmit.parkId;
        }
      } else {
        // 如果 factoryId 不是数组 (例如直接是ID), 则不需要这部分处理
        // 或者如果它是可选的，并且不是数组，则可能需要删除 parkId
        delete dataToSubmit.parkId;
      }

      // 修改: firefightingId -> hygieneCheckId
      const { hygieneCheckId: recordIdToUpdate } = modalApi.getData() || {};
      try {
        // 修改: checkTime -> checkDate
        if (dataToSubmit.checkDate) {
          dataToSubmit.checkDate = new Date(
            dataToSubmit.checkDate,
          ).toISOString();
        }

        // 修改: API 函数调用
        await (recordIdToUpdate
          ? updateHygieneCheck(recordIdToUpdate, dataToSubmit)
          : createHygieneCheck(dataToSubmit));
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
        // 确保 data 中有 parkId 和 factoryId
        if (data.parkId && data.factoryId) {
          formData.value.factoryId = [data.parkId, data.factoryId];
        } else if (data.factoryId) {
          // 如果只有 factoryId (例如，非级联选择)
          formData.value.factoryId = data.factoryId;
        } else {
          formData.value.factoryId = [];
        }
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
