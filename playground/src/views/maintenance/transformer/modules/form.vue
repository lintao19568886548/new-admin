<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'; // 新增导入 onMounted

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createTransformer, updateTransformer } from '#/api/maintenance';
import { $t } from '#/locales';

import { getParkFactoryCascaderOptions, useFormSchema } from '../data'; // 新增导入 getParkFactoryCascaderOptions

const emit = defineEmits(['success']);
const formData = ref();
const getTitle = computed(() => {
  return formData.value?.transformerId // 确保这里是 transformerId
    ? $t('ui.actionTitle.edit', [$t('page.maintenance.title')])
    : $t('ui.actionTitle.create', [$t('page.maintenance.title')]);
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

onMounted(async () => {
  try {
    const parkCascaderOptions = await getParkFactoryCascaderOptions();

    if (parkCascaderOptions.length > 0) {
      formApi.updateSchema([
        {
          componentProps: {
            options: parkCascaderOptions,
          },
          fieldName: 'factoryId',
        },
      ]);
    } else {
      console.error(
        '加载园区或厂房数据失败 (form Cascader): 未获取到有效数据或数据为空',
      );
      formApi.updateSchema([
        {
          componentProps: { options: [] },
          fieldName: 'factoryId',
        },
      ]);
    }
  } catch (error) {
    console.error('在 form.vue 中加载园区及厂房数据失败:', error);
    formApi.updateSchema([
      {
        componentProps: { options: [] },
        fieldName: 'factoryId',
      },
    ]);
  }

  if (formData.value) {
    // 如果是编辑模式，并且 formData.value.factoryId 已经是 [parkId, factoryId] 格式
    // 需要确保在 options 加载后，如果 factoryId 是数组，Cascader 能正确回显
    // Ant Design Vue 的 Cascader 通常在 options 更新后，如果 value 存在于新 options 中，会自动匹配
    // 如果 formData.value 包含 parkId 和 factoryId，需要将其构造成数组形式
    if (formData.value.parkId && formData.value.factoryId) {
      const cascaderValue = [formData.value.parkId, formData.value.factoryId];
      formApi.setValues({ ...formData.value, factoryId: cascaderValue });
    } else {
      formApi.setValues(formData.value);
    }
  }
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
          // 根据实际需求处理，当前配置 changeOnSelect: false，应总是有两个值或为空
          // 假设如果只选了一级，则为 parkId，factoryId 需要清除或后端处理
          dataToSubmit.parkId = cascaderValue[0];
          delete dataToSubmit.factoryId; // 或者根据业务逻辑设置
        } else {
          // 清除或设置默认值，如果选择不完整
          delete dataToSubmit.factoryId;
          delete dataToSubmit.parkId;
        }
      }

      const { transformerId } = modalApi.getData();
      try {
        if (dataToSubmit.checkTime) {
          dataToSubmit.checkTime = new Date(
            dataToSubmit.checkTime,
          ).toISOString();
        }

        await (transformerId
          ? updateTransformer(transformerId, dataToSubmit)
          : createTransformer(dataToSubmit));
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
        // 如果是编辑，并且 factoryId 已经是数组形式，则直接使用
        // 否则，需要根据 parkId 和 factoryId 构造
        if (data.parkId && data.factoryId && !Array.isArray(data.factoryId)) {
          const cascaderValue = [data.parkId, data.factoryId];
          formApi.setValues({ ...data, factoryId: cascaderValue });
        } else {
          formApi.setValues(data);
        }
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
