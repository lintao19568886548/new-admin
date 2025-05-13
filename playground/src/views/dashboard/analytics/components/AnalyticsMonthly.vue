<script lang="ts" setup>
import { getAnalyticsData } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getMonthlyChartConfig } from './chartConfigs';

// 定义数据获取函数
const fetchData = async () => {
  return await getAnalyticsData({ type: 'months' });
};

// 生成图表配置函数
const generateChartConfig = (data: any) => {
  return getMonthlyChartConfig(data);
};
</script>

<template>
  <BaseChart
    :chart-config-fn="generateChartConfig"
    :fetch-data-fn="fetchData"
  />
</template>
