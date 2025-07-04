<script lang="ts" setup>
import BaseChart from './BaseChart.vue';
import { getMonthlyChartConfig } from './chartConfigs';

interface Props {
  data: any;
}

const props = defineProps<Props>();

// 生成图表配置函数
const generateChartConfig = (data: any) => {
  return getMonthlyChartConfig(data);
};
</script>

<template>
  <BaseChart :chart-config-fn="generateChartConfig" :chart-data="props.data" />
</template>
