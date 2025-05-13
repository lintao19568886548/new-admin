<script lang="ts" setup>
import { getAnalyticsData } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getTrendsChartConfig } from './chartConfigs';

// 定义数据获取函数
const fetchData = async () => {
  return await getAnalyticsData({ type: 'days' });
};
</script>

<template>
  <BaseChart
    :chart-config-fn="getTrendsChartConfig"
    :fetch-data-fn="fetchData"
  />
</template>
