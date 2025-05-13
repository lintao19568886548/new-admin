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
  // 排序数据以保持与原组件相同的显示效果
  if (data?.expense?.length) {
    const sortedData = [...data.expense];
    for (let i = 0; i < sortedData.length; i++) {
      for (let j = i + 1; j < sortedData.length; j++) {
        if (sortedData[j].value > sortedData[i].value) {
          [sortedData[i], sortedData[j]] = [sortedData[j], sortedData[i]];
        }
      }
    }
    return sortedData;
  }
  return [];
};

// 生成图表配置函数
const generateChartConfig = (data: any) => {
  return getPieChartConfig(data, 'expense');
};
</script>

<template>
  <BaseChart
    :chart-config-fn="generateChartConfig"
    :fetch-data-fn="fetchData"
    :process-data-fn="processData"
  />
</template>
