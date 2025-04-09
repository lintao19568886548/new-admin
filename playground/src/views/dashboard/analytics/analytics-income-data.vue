<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getAnalyticsTrend } from '#/api/analytics';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(async () => {
  const { income } = await getAnalyticsTrend();

  // 计算最大值
  const maxValue =
    Math.max(...income.map((item: { value: number }) => item.value)) * 1.2;

  // 构建雷达图指标
  const indicator = income.map((item: { name: string; value: number }) => ({
    max: maxValue,
    name: item.name,
  }));

  renderEcharts({
    legend: {
      bottom: 0,
      data: ['收入趋势'],
    },
    radar: {
      indicator,
      radius: '60%',
      splitNumber: 2,
    },
    series: [
      {
        areaStyle: {
          opacity: 0.8,
          shadowBlur: 10,
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowOffsetX: 0,
          shadowOffsetY: 10,
        },
        data: [
          {
            itemStyle: {
              color: '#5ab1ef',
            },
            name: '收入趋势',
            value: income.map((item: { value: number }) => item.value),
          },
        ],
        itemStyle: {
          borderRadius: 10,
          borderWidth: 2,
        },
        symbolSize: 0,
        type: 'radar',
      },
    ],
    tooltip: {},
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
