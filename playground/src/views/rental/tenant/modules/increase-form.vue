<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { useVbenForm } from '@vben/common-ui';

import { useIncreaseFormSchema } from '../data';

// 定义props和emits
const props = defineProps<{
  modelValue?: {
    date: number;
    rate: number;
  }[];
}>();

const emit = defineEmits(['update:modelValue']);

// 标记是否正在由内部更新表单值，避免触发额外的更新
const isInternalUpdate = ref(false);
// 标记是否已经初始化
const isInitialized = ref(false);

// 使用表单，获取表单API
const [Form, formApi] = useVbenForm({
  commonConfig: {
    // 所有表单项
    componentProps: {
      class: 'mb-1 w-full',
    },
  },
  handleValuesChange: (values) => {
    // 如果是内部更新触发的变化，不处理
    if (isInternalUpdate.value) {
      return;
    }

    // 当递增选项变化时，立即更新内部状态
    if (values.increase !== undefined) {
      // 处理数据并发送到外部
      const increaseData = processFormData(values);

      // 延迟发送更新，避免与watch函数冲突
      setTimeout(() => {
        emit('update:modelValue', increaseData);
      }, 0);
    }
  },
  layout: 'vertical',
  schema: useIncreaseFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-3 gap-4',
});

// 处理表单数据，转换成需要的格式
function processFormData(values: Record<string, any>) {
  const result: { date: number; rate: number }[] = [];

  // 如果选择了"无"，则返回空数组
  if (!values.increase || values.increase === '无') {
    return result;
  }

  // 处理各个递增级别的数据
  // 注意：只处理当前选择级别及以下的数据
  const maxLevel = Number.parseInt(values.increase, 10);
  for (let i = 1; i <= maxLevel; i++) {
    const level = i.toString();
    if (
      values[`increaseDate_${level}`] !== undefined &&
      values[`increaseRate_${level}`] !== undefined
    ) {
      result.push({
        date: values[`increaseDate_${level}`],
        rate: values[`increaseRate_${level}`],
      });
    }
  }

  return result;
}

// 在组件挂载后初始化
onMounted(() => {
  // 延迟初始化，确保父组件已经传递了数据
  setTimeout(() => {
    // 确保modelValue是数组
    if (
      props.modelValue &&
      Array.isArray(props.modelValue) &&
      props.modelValue.length > 0
    ) {
      initializeForm(props.modelValue);
    } else {
      formApi.setValues({ increase: '无' });
      isInitialized.value = true;
    }
  }, 200);
});

// 初始化表单函数
function initializeForm(data: any[]) {
  isInternalUpdate.value = true;

  try {
    const level = data.length.toString();

    const formValues: Record<string, any> = {
      increase: level,
    };

    // 填充各个递增级别的数据
    data.forEach((item, index) => {
      const itemLevel = (index + 1).toString();
      formValues[`increaseDate_${itemLevel}`] = item.date;
      formValues[`increaseRate_${itemLevel}`] = item.rate;
    });

    formApi.setValues(formValues);
    isInitialized.value = true;
  } finally {
    setTimeout(() => {
      isInternalUpdate.value = false;
    }, 300);
  }
}

// 监听props.modelValue的变化
watch(
  () => props.modelValue,
  (newValue) => {
    // 如果已经初始化，则不再设置表单值
    if (isInitialized.value) {
      return;
    }

    // 确保newValue是数组
    if (newValue && Array.isArray(newValue) && newValue.length > 0) {
      initializeForm(newValue);
    }
  },
  { deep: true },
);
</script>
<template>
  <div>
    <Form />
  </div>
</template>
