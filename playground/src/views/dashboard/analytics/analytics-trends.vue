<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getAnalyticsData } from '#/api/analytics';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(async () => {
  const { expenseData, incomeData } = await getAnalyticsData({
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
        areaStyle: {},
        data: incomeData,
        itemStyle: {
          color: '#5ab1ef',
        },
        name: '收入',
        smooth: true,
        type: 'line',
      },
      {
        areaStyle: {},
        data: expenseData,
        itemStyle: {
          color: '#019680',
        },
        name: '支出',
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: {
      axisPointer: {
        lineStyle: {
          color: '#019680',
          width: 1,
        },
      },
      trigger: 'axis',
    },
    // xAxis: {
    //   axisTick: {
    //     show: false,
    //   },
    //   boundaryGap: false,
    //   data: Array.from({ length: 18 }).map((_item, index) => `${index + 6}:00`),
    //   type: 'category',
    // },
    xAxis: {
      axisTick: {
        show: false,
      },
      boundaryGap: false,
      data: Array.from({ length: 31 }).map((_item, index) => `${index + 1}日`),
      splitLine: {
        lineStyle: {
          type: 'solid',
          width: 1,
        },
        show: true,
      },
      type: 'category',
    },
    yAxis: [
      {
        axisTick: {
          show: false,
        },
        max: 120_000,
        splitArea: {
          show: true,
        },
        splitNumber: 4,
        type: 'value',
      },
    ],
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
