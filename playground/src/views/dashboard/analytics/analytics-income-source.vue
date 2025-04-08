<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(() => {
  renderEcharts({
    legend: {
      bottom: '2%',
      left: 'center',
    },
    series: [
      {
        animationDelay() {
          return Math.random() * 100;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        avoidLabelOverlap: false,
        color: ['#5ab1ef', '#91cc75'],
        data: [
          { name: '本月收入', value: 25_000 },
          { name: '上月收入', value: 22_000 },
        ],
        emphasis: {
          label: {
            fontSize: '14',
            fontWeight: 'bold',
            show: true,
          },
        },
        itemStyle: {
          borderRadius: 10,
          borderWidth: 2,
        },
        label: {
          formatter: '{b}\n{c}元',
          position: 'inside',
          show: true,
        },
        labelLine: {
          show: false,
        },
        name: '收入环比',
        radius: ['40%', '65%'],
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c}元',
      trigger: 'item',
    },
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
