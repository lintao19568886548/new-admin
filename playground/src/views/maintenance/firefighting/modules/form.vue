<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'; // <-- 新增导入 onMounted

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createFirefighting, updateFirefighting } from '#/api/maintenance';
import { $t } from '#/locales';

import { getParkFactoryCascaderOptions, useFormSchema } from '../data'; // <-- 新增导入 getParkFactoryCascaderOptions

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

onMounted(async () => {
  try {
    const parkCascaderOptions = await getParkFactoryCascaderOptions();

    if (parkCascaderOptions.length > 0) {
      // 更新 Cascader 组件的 options
      formApi.updateSchema([
        {
          componentProps: {
            loadData: undefined, // 确保移除旧的 loadData
            options: parkCascaderOptions,
          },
          fieldName: 'factoryId',
        },
      ]);
    } else {
      // 处理获取 options 失败或为空的情况
      console.error(
        '加载园区或厂房数据失败 (form Cascader): 未获取到有效数据或数据为空',
      );
      formApi.updateSchema([
        {
          componentProps: { loadData: undefined, options: [] },
          fieldName: 'factoryId',
        },
      ]);
    }
  } catch (error) {
    // 进一步的错误处理（虽然 getParkFactoryCascaderOptions 内部已经 console.error）
    console.error('在 form.vue 中加载园区及厂房数据失败:', error);
    formApi.updateSchema([
      {
        componentProps: { loadData: undefined, options: [] },
        fieldName: 'factoryId',
      },
    ]);
  }

  // 保留用户可能已有的编辑数据加载逻辑
  if (formData.value) {
    // 如果是编辑模式，并且 formData.value.factoryId 已经是 [parkId, factoryId] 格式
    // 并且 options 已经加载完毕，Ant Design Vue 的 Cascader 通常会自动匹配显示
    // 如果没有自动匹配，可能需要 formApi.setValues(formData.value) 来触发更新
    // 但由于 options 是异步加载的，setValues 最好在 options 加载完成后执行
    // 或者确保 formData.value.factoryId 的结构与新的 options 匹配
    // 此处假设 Ant Design Vue Cascader 会在 options 更新后自行处理值的显示
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
          // 如果只选择了一个层级（例如，如果 changeOnSelect 为 true）
          // 这里根据实际需求处理，当前配置 changeOnSelect: false，应总是有两个值或为空
          dataToSubmit.factoryId = cascaderValue[0]; // 或者根据情况设置 parkId
        } else {
          // 清除或设置默认值，如果选择不完整
          delete dataToSubmit.factoryId;
          delete dataToSubmit.parkId;
        }
      }

      const { firefightingId: recordIdToUpdate } = modalApi.getData();
      try {
        if (dataToSubmit.checkTime) {
          dataToSubmit.checkTime = new Date(
            dataToSubmit.checkTime,
          ).toISOString();
        }

        await (recordIdToUpdate
          ? updateFirefighting(recordIdToUpdate, dataToSubmit)
          : createFirefighting(dataToSubmit));
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
