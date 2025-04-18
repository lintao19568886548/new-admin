<script lang="ts" setup>
import { Input, Select, Tooltip } from 'ant-design-vue';

const emit = defineEmits(['blur', 'change']);

const modelValue = defineModel<[string, number, number]>({
  default: () => ['equal', undefined, undefined],
});

function onChange() {
  emit('change', modelValue.value);
}
</script>
<template>
  <Tooltip>
    <template v-if="modelValue[0] === 'between'" #title>
      <span>可只填一边</span>
    </template>
    <div class="flex w-full gap-1">
      <Select
        v-model:value="modelValue[0]"
        class="w-[80px]"
        placeholder="类型"
        :class="{ 'valid-success': !!modelValue[0] }"
        :options="[
          { label: '等于', value: 'equal' },
          { label: '区间', value: 'between' },
        ]"
        @blur="emit('blur')"
        @change="onChange"
      />
      <Input
        v-if="modelValue[0] === 'equal'"
        placeholder="请输入值"
        class="flex-1"
        allow-clear
        v-model:value="modelValue[1]"
        @blur="emit('blur')"
        @change="onChange"
      />
      <Input
        v-if="modelValue[0] === 'between'"
        placeholder="请输入最小值"
        class="flex-1"
        allow-clear
        v-model:value="modelValue[1]"
        @blur="emit('blur')"
        @change="onChange"
      />
      <Input
        v-if="modelValue[0] === 'between'"
        placeholder="请输入最大值"
        class="flex-1"
        allow-clear
        v-model:value="modelValue[2]"
        @blur="emit('blur')"
        @change="onChange"
      />
    </div>
  </Tooltip>
</template>
