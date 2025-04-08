<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getFinanceAnalyticsData } from '#/api/finance/finance';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);
onMounted(async () => {
  const { expenseData, incomeData } = await getFinanceAnalyticsData({
    type: 'days', // 后端支持按月查询
  });
  renderEcharts({
    grid: {
      bottom: 0,
      containLabel: true,
      left: '1%',
      right: '1%',
      top: '2 %',
    },
    series: [
      {
        barMaxWidth: 80,
        color: '#5ab1ef', // 支出用浅蓝色
        data: expenseData,
        name: '支出',
        type: 'bar',
      },

      {
        barMaxWidth: 80,
        color: '#91cc75', // 收入用浅绿色
        data: incomeData,
        name: '收入',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: {
        lineStyle: {
          // color: '#4f69fd',
          width: 1,
        },
      },
      trigger: 'axis',
    },
    xAxis: {
      data: Array.from({ length: 12 }).map((_item, index) => `${index + 1}月`),
      type: 'category',
    },
    yAxis: {
      max: 8000,
      splitNumber: 4,
      type: 'value',
    },
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
