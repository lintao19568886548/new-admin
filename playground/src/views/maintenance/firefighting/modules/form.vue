<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'; // <-- 新增导入 onMounted

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getFactoryListByParkId } from '#/api/factory'; // <-- 确保这个导入存在
// import { getParkList } from '#/api/park'; // <-- 移除这个导入
import { createFirefighting, updateFirefighting } from '#/api/maintenance';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

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
    // 1. 仅调用 getFactoryListByParkId，它现在会返回包含园区信息的厂房列表
    const allFactoriesResponse = await getFactoryListByParkId();
    // 预期的类型: Array<{ factoryId: number; factoryName: string; parkId: number; park: { parkName: string }; ... }>

    if (
      allFactoriesResponse &&
      Array.isArray(allFactoriesResponse) &&
      allFactoriesResponse.length > 0
    ) {
      const allFactories = allFactoriesResponse as Array<{
        factoryId: number;
        factoryName: string;
        park: { parkName: string };
        parkId: number;
      }>;

      // 使用 Map 来收集唯一的园区并聚合其下的厂房
      const parksMap = new Map<
        number,
        {
          children: Array<{ isLeaf: boolean; name: string; value: number }>;
          name: string;
          value: number;
        }
      >();

      for (const factory of allFactories) {
        if (!parksMap.has(factory.parkId)) {
          parksMap.set(factory.parkId, {
            name: factory.park.parkName, // 园区名称
            value: factory.parkId, // 园区ID
            children: [],
          });
        }
        // 为对应园区添加厂房
        parksMap.get(factory.parkId)!.children.push({
          isLeaf: true, // 厂房是叶子节点
          name: factory.factoryName, // 厂房名称
          value: factory.factoryId, // 厂房ID
        });
      }

      const parkCascaderOptions = [...parksMap.values()];

      // 更新 Cascader 组件的 options
      formApi.updateSchema([
        {
          componentProps: {
            loadData: undefined,
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
          componentProps: { loadData: undefined, options: [] },
          fieldName: 'factoryId',
        },
      ]);
    }
  } catch (error) {
    console.error('加载园区及厂房数据失败 (form Cascader):', error);
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
