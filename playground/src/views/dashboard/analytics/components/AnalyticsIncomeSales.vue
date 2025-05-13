<script lang="ts" setup>
import { getAnalyticsTotal } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getPieChartConfig } from './chartConfigs';

// 定义数据获取函数
const fetchData = async () => {
  return await getAnalyticsTotal();
};

// 数据处理函数
const processData = (data: any) => {
  if (data?.income?.length) {
    return data.income.sort(
      (a: { value: number }, b: { value: number }) => b.value - a.value,
    );
  }
  return [];
};

// 生成图表配置函数
const generateChartConfig = (data: any) => {
  return getPieChartConfig(data, 'income');
};
</script>

<template>
  <BaseChart
    :chart-config-fn="generateChartConfig"
    :fetch-data-fn="fetchData"
    :process-data-fn="processData"
  />
</template>
