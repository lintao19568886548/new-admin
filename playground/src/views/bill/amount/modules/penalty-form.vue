<script lang="ts" setup>
import { onMounted, reactive, ref, watch } from 'vue';

import { ArrowDown, ArrowUp } from '@vben/icons'; // 使用 @vben/icons 中的图标

import { Button, InputNumber } from 'ant-design-vue';

const props = defineProps<{
  penaltyAmount?: number;
  penaltyDays?: number;
  penaltyRate?: number;
}>();

const emit = defineEmits(['blur', 'change']);

const modelValue = defineModel<{
  penaltyList: [number | undefined, number | undefined][];
  penaltyRate: number | undefined;
}>({
  default: () => ({
    penaltyList: [[undefined, undefined]], // 初始化时至少包含一个元素
    penaltyRate: undefined,
  }),
});

// 当前选择的期数，现在直接是数字
const currentPeriod = ref(1);

// 每个期数对应的滞纳天数和滞纳金额
// 使用 Record<number, ...> 而不是 Record<string, ...>
const periodValues = reactive<
  Record<number, [number | undefined, number | undefined]>
>({
  1: [undefined, undefined], // 初始化第一期
});

// Watch for changes in the modelValue from the parent component
// and update the internal periodValues cache.
watch(
  () => modelValue.value.penaltyList,
  (newList) => {
    if (newList) {
      // Repopulate the cache from the new source of truth
      newList.forEach((item, index) => {
        const period = index + 1;
        periodValues[period] = [...item]; // Use spread to create a copy
      });
    }
  },
  { deep: true, immediate: true }, // immediate: run on component load
);

// 检查并添加新期数的数据槽
function ensurePeriodOption(period: number) {
  if (!periodValues[period]) {
    periodValues[period] = [undefined, undefined];
  }
}

// 加载期数数据
function loadPeriodData(period: number) {
  ensurePeriodOption(period); // 确保目标期数存在数据槽
  const periodData = periodValues[period];

  // 确保 penaltyList 数组有足够的长度
  while (modelValue.value.penaltyList.length < period) {
    modelValue.value.penaltyList.push([undefined, undefined]);
  }

  if (periodData) {
    modelValue.value.penaltyList[period - 1] = [periodData[0], periodData[1]];
  } else {
    modelValue.value.penaltyList[period - 1] = [undefined, undefined];
  }
}

// 保存当前期数的数据
function saveCurrentPeriodData() {
  ensurePeriodOption(currentPeriod.value); // 确保当前期数存在数据槽

  // 确保 penaltyList 数组有足够的长度
  while (modelValue.value.penaltyList.length < currentPeriod.value) {
    modelValue.value.penaltyList.push([undefined, undefined]);
  }

  // 确保当前期数的数据存在
  if (!modelValue.value.penaltyList[currentPeriod.value - 1]) {
    modelValue.value.penaltyList[currentPeriod.value - 1] = [
      undefined,
      undefined,
    ];
  }

  // 此时 currentData 一定存在，因为我们已经确保了它
  const currentData = modelValue.value.penaltyList[currentPeriod.value - 1]!;
  periodValues[currentPeriod.value] = [currentData[0], currentData[1]];
}

// 点击向上箭头
function incrementPeriod() {
  saveCurrentPeriodData(); // 保存当前期的数据
  currentPeriod.value++;
  loadPeriodData(currentPeriod.value); // 加载新期数的数据 (如果新，ensurePeriodOption会创建)
  onChange();
}

// 点击向下箭头
function decrementPeriod() {
  if (currentPeriod.value <= 1) return; // 不能少于1
  saveCurrentPeriodData(); // 保存当前期的数据
  currentPeriod.value--;
  loadPeriodData(currentPeriod.value); // 加载新期数的数据
  onChange();
}

// 当滞纳天数或金额在输入框中变化时，保存到当前期数
function handleManualValueChange(
  value: null | number | string | undefined,
  index: 0 | 1,
) {
  // 确保 penaltyList 数组有足够的长度
  while (modelValue.value.penaltyList.length < currentPeriod.value) {
    modelValue.value.penaltyList.push([undefined, undefined]);
  }

  // 更新当前期数的对应值
  if (!modelValue.value.penaltyList[currentPeriod.value - 1]) {
    modelValue.value.penaltyList[currentPeriod.value - 1] = [
      undefined,
      undefined,
    ];
  }

  // 将字符串值转换为数字或undefined
  let finalValue: number | undefined;
  if (value !== null && value !== undefined && value !== '') {
    finalValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  }

  // 此时我们已确保数组元素存在
  const currentPenalty = modelValue.value.penaltyList[currentPeriod.value - 1]!;
  currentPenalty[index] = finalValue;

  saveCurrentPeriodData();
  onChange();
}

// 在script部分添加一个辅助函数来安全地获取penaltyList的值
function safeGetPenaltyValue(
  index: number,
  valueIndex: 0 | 1,
): number | undefined {
  try {
    // 确保modelValue.value.penaltyList存在
    if (!modelValue.value.penaltyList) {
      modelValue.value.penaltyList = [];
    }

    // 确保数组有足够的长度
    while (modelValue.value.penaltyList.length < index) {
      modelValue.value.penaltyList.push([undefined, undefined]);
    }

    // 如果指定索引位置没有值，初始化它
    if (!modelValue.value.penaltyList[index - 1]) {
      modelValue.value.penaltyList[index - 1] = [undefined, undefined];
      return undefined;
    }

    // 安全地返回值
    const value = modelValue.value.penaltyList[index - 1]?.[valueIndex];
    return value;
  } catch (error) {
    console.error('获取滞纳金值出错:', error);
    return undefined;
  }
}

onMounted(() => {
  // 确保 modelValue 中的 penaltyList 至少有一项
  if (
    !modelValue.value.penaltyList ||
    modelValue.value.penaltyList.length === 0
  ) {
    modelValue.value.penaltyList = [[undefined, undefined]];
  }

  // 设置滞纳金比率
  if (
    modelValue.value.penaltyRate === undefined &&
    props.penaltyRate !== undefined
  ) {
    modelValue.value.penaltyRate = props.penaltyRate;
  }

  // 初始化第一期的值 (如果props提供了)
  if (props.penaltyDays !== undefined || props.penaltyAmount !== undefined) {
    periodValues[1] = [props.penaltyDays, props.penaltyAmount];
    // 如果当前期数是1 (默认)，则加载这些初始值到modelValue
    if (currentPeriod.value === 1) {
      loadPeriodData(1);
    }
  }
  // 确保至少第一期的数据槽存在
  ensurePeriodOption(1);
});

function onChange() {
  // 准备返回的数据结构，通过创建新对象来触发 v-model 更新
  modelValue.value = {
    penaltyList: modelValue.value.penaltyList,
    penaltyRate: modelValue.value.penaltyRate,
  };

  emit('change', modelValue.value);
}
</script>

<template>
  <div class="flex w-full items-center gap-6">
    <InputNumber
      v-model:value="modelValue.penaltyRate"
      placeholder="滞纳金比率"
      class="flex-1"
      addon-after="‰"
      allow-clear
      :class="{ 'valid-success': !!modelValue.penaltyRate }"
      @blur="emit('blur')"
      @change="onChange"
    />

    <InputNumber
      :value="safeGetPenaltyValue(currentPeriod, 0)"
      placeholder="滞纳天数"
      class="flex-1"
      addon-after="天"
      allow-clear
      :class="{
        'valid-success': !!safeGetPenaltyValue(currentPeriod, 0),
      }"
      @blur="emit('blur')"
      @change="(value) => handleManualValueChange(value, 0)"
    />
    <InputNumber
      :value="safeGetPenaltyValue(currentPeriod, 1)"
      placeholder="滞纳金额"
      class="flex-1"
      allow-clear
      addon-after="元"
      :class="{
        'valid-success': !!safeGetPenaltyValue(currentPeriod, 1),
      }"
      type="tel"
      @blur="emit('blur')"
      @change="(value) => handleManualValueChange(value, 1)"
    />

    <!-- 期数控制器 -->
    <div class="flex items-center rounded-md border border-gray-300">
      <span class="px-3">明细 {{ currentPeriod }} </span>
      <Button
        size="small"
        class="!h-[30px] !border-none !px-2"
        @click="decrementPeriod"
        :disabled="currentPeriod <= 1"
      >
        <ArrowUp class="size-4" />
      </Button>
      <Button
        size="small"
        class="!h-[30px] !border-none !px-2"
        @click="incrementPeriod"
      >
        <ArrowDown class="size-4" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
/* 您可以根据需要添加额外的样式来微调布局和外观 */
</style>
