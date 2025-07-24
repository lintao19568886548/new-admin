<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { InputNumber } from 'ant-design-vue';

// 添加props定义，接收表单组件传递的属性
const props = defineProps({
  modelValue: {
    default: () => ({}),
    type: [Object, String], // 支持 Object 和 String 类型
  },
});

// 添加emit定义，用于更新表单值
const emit = defineEmits(['update:modelValue']);

// 解析size字符串的函数
const parseSizeString = (
  sizeStr: string,
): {
  height: number | undefined;
  length: number | undefined;
  width: number | undefined;
} => {
  if (!sizeStr)
    return { height: undefined, length: undefined, width: undefined };

  const sizeMatch = sizeStr.match(
    /长(\d+(\.\d+)?)米\*宽(\d+(\.\d+)?)米\*高(\d+(\.\d+)?)米/,
  );
  if (sizeMatch) {
    const height = Number.parseFloat(sizeMatch[5]!);
    const length = Number.parseFloat(sizeMatch[1]!);
    const width = Number.parseFloat(sizeMatch[3]!);
    return {
      height: Number.isNaN(height) ? undefined : height,
      length: Number.isNaN(length) ? undefined : length,
      width: Number.isNaN(width) ? undefined : width,
    };
  }
  return { height: undefined, length: undefined, width: undefined };
};

// 合并尺寸为size字符串的函数
const formatSizeString = (
  length: null | number,
  width: null | number,
  height: null | number,
) => {
  if (length && width && height) {
    return `长${length}米*宽${width}米*高${height}米`;
  }
  return '';
};

// 计算属性，用于双向绑定
const internalData = ref<{
  height: number | undefined;
  length: number | undefined;
  width: number | undefined;
}>({ height: undefined, length: undefined, width: undefined });

const formData = computed(() => internalData.value);

// 监听外部modelValue的变化，但要避免响应由内部触发的更新
watch(
  () => props.modelValue,
  (newValue) => {
    let newSize = null;

    if (typeof newValue === 'string') {
      newSize = newValue;
    } else if (
      newValue &&
      typeof newValue === 'object' &&
      typeof newValue.size === 'string'
    ) {
      newSize = newValue.size;
    }

    const currentSize = formatSizeString(
      internalData.value.length ?? null,
      internalData.value.width ?? null,
      internalData.value.height ?? null,
    );

    // 仅当外部传入的size字符串与内部状态生成的不一致时，才进行更新
    if (newSize !== currentSize) {
      const parsed = parseSizeString(newSize || '');
      internalData.value.length = parsed.length;
      internalData.value.width = parsed.width;
      internalData.value.height = parsed.height;
    }
  },
  { deep: true, immediate: true },
);

// 更新单个字段的方法
const updateField = (
  field: 'height' | 'length' | 'width',
  value: null | number,
) => {
  internalData.value[field] = value ?? undefined;

  const { height, length, width } = internalData.value;
  const newSizeString = formatSizeString(
    length ?? null,
    width ?? null,
    height ?? null,
  );

  // 如果 modelValue 是字符串，则直接返回 size 字符串
  if (typeof props.modelValue === 'string') {
    emit('update:modelValue', newSizeString);
    return;
  }

  // 如果 modelValue 是对象，则更新对象并返回
  emit('update:modelValue', {
    ...props.modelValue,
    height,
    length,
    size: newSizeString,
    width,
  });
};
</script>

<template>
  <div class="w-full">
    <div class="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-4">
      <!-- 长度输入框 -->
      <div class="flex items-center">
        <label class="mr-2 flex-shrink-0 text-sm font-medium"> 长</label>
        <InputNumber
          :value="formData.length"
          :min="0"
          :precision="2"
          addon-after="米"
          placeholder="请输入"
          class="flex-1"
          @change="(value) => updateField('length', value as number)"
        />
      </div>

      <!-- 宽度输入框 -->
      <div class="flex items-center">
        <label class="mr-2 flex-shrink-0 text-sm font-medium"> 宽</label>
        <InputNumber
          :value="formData.width"
          :min="0"
          :precision="2"
          addon-after="米"
          placeholder="请输入"
          class="flex-1"
          @change="(value) => updateField('width', value as number)"
        />
      </div>

      <!-- 高度输入框 -->
      <div class="flex items-center">
        <label class="mr-2 flex-shrink-0 text-sm font-medium"> 高</label>
        <InputNumber
          :value="formData.height"
          :min="0"
          :precision="2"
          addon-after="米"
          placeholder="请输入"
          class="flex-1"
          @change="(value) => updateField('height', value as number)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义样式 */
.grid {
  align-items: center;
}

label {
  text-align: left;
}
</style>
