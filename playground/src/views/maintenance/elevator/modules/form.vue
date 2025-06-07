<script lang="ts" setup>
import { computed, ref } from 'vue';

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
  wrapperClass: 'grid-cols-3 gap-4',
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

      // 合并尺寸字段
      if (
        dataToSubmit.sizeLength &&
        dataToSubmit.sizeWidth &&
        dataToSubmit.sizeHeight
      ) {
        dataToSubmit.size = `长${dataToSubmit.sizeLength}米*宽${dataToSubmit.sizeWidth}米*高${dataToSubmit.sizeHeight}米`;
      }
      // 删除原始尺寸字段
      delete dataToSubmit.sizeLength;
      delete dataToSubmit.sizeWidth;
      delete dataToSubmit.sizeHeight;

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
        // 将 productionDate 转换为 ISO-8601 格式
        if (dataToSubmit.productionDate) {
          dataToSubmit.productionDate = new Date(
            dataToSubmit.productionDate,
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

        // 解析 size 字符串填充长宽高字段
        if (data.size?.length > 0) {
          const sizeMatch = data.size.match(
            /长(\d+(\.\d+)?)米\*宽(\d+(\.\d+)?)米\*高(\d+(\.\d+)?)米/,
          );
          if (sizeMatch) {
            formData.value.sizeLength = sizeMatch[1];
            formData.value.sizeWidth = sizeMatch[3];
            formData.value.sizeHeight = sizeMatch[5];
          }
        }

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
