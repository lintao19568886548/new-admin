<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { $t } from '#/locales';

const props = defineProps({
  // 日期字段列表
  dateFields: {
    default: () => [],
    type: Array as () => string[],
  },
  // 实体名称
  entityName: {
    required: true,
    type: String,
  },
  // 提交处理函数
  handleSubmit: {
    required: true,
    type: Function,
  },
  // 实体ID字段
  idField: {
    default: 'id',
    type: String,
  },
  // 数据处理函数
  processData: {
    default: (data: any) => data,
    type: Function,
  },
  // 表单配置
  schema: {
    required: true,
    type: Array as () => VbenFormSchema[],
  },
});

const emit = defineEmits(['success']);
const formData = ref<Record<string, any>>();
const getTitle = computed(() => {
  const isEdit = formData.value && formData.value[props.idField];

  return isEdit
    ? $t('ui.actionTitle.edit', [$t(props.entityName)])
    : $t('ui.actionTitle.create', [$t(props.entityName)]);
});

// 修改这里，直接使用对象而不是 computed
const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: props.schema,
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

    // 处理日期字段
    props.dateFields.forEach((field) => {
      if (values[field]) {
        values[field] = dayjs(values[field]).format('YYYY-MM-DD');
      }
    });

    // 处理数据
    const processedData = props.processData(values);

    console.warn('提交表单数据', processedData);
    modalApi.lock();

    try {
      const success = await props.handleSubmit(processedData, id.value);
      if (success) {
        emit('success');
        modalApi.close();
      }
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData<Record<string, any>>();
      console.warn('打开表单，数据:', data);
      formApi.resetForm();
      if (data && Object.keys(data).length > 0) {
        // 处理日期格式
        const processedData = { ...data };
        props.dateFields.forEach((field) => {
          if (processedData[field]) {
            processedData[field] = dayjs(processedData[field]).format(
              'YYYY-MM-DD',
            );
          }
        });

        formData.value = processedData;
        id.value = processedData[props.idField];
        formApi.setValues(processedData);
      } else {
        id.value = undefined;
        formData.value = undefined;
        // 可以设置默认值
        formApi.setValues({} as Record<string, any>);
      }
    }
  },
});

defineExpose({
  modalApi,
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
