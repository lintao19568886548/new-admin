<script lang="ts" setup>
import { getAnalyticsMonth } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getCompareChartConfig } from './chartConfigs';

// 定义数据获取函数
const fetchData = async () => {
  return await getAnalyticsMonth();
};

// 数据处理函数，直接返回原始数据，在图表配置函数中进行处理
const processData = (data: any) => data;

// 生成图表配置函数
const generateChartConfig = (data: any) => {
  return getCompareChartConfig(
    data.currentMonth.expense,
    data.lastMonth.expense,
    'expense',
  );
};
</script>

<template>
  <BaseChart
    :chart-config-fn="generateChartConfig"
    :fetch-data-fn="fetchData"
    :process-data-fn="processData"
  />
</template>
