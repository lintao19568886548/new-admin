<script lang="ts" setup>
import { getAnalyticsTrend } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getRadarChartConfig } from './chartConfigs';

// 定义数据获取函数
const fetchData = async () => {
  return await getAnalyticsTrend();
};

// 数据处理函数
const processData = (data: any) => {
  return data.expense;
};

// 生成图表配置函数
const generateChartConfig = (data: any) => {
  return getRadarChartConfig(data, 'expense');
};
</script>

<template>
  <BaseChart
    :chart-config-fn="generateChartConfig"
    :fetch-data-fn="fetchData"
    :process-data-fn="processData"
  />
</template>
