<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getAnalyticsTotal } from '#/api/analytics';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(async () => {
  try {
    const { income } = await getAnalyticsTotal();

    renderEcharts({
      legend: {
        bottom: '2%',
        left: 'center',
      },
      series: [
        {
          animationDelay() {
            return Math.random() * 400;
          },
          animationEasing: 'exponentialInOut',
          animationType: 'scale',
          center: ['50%', '50%'],
          color: ['#5ab1ef', '#b6a2de', '#67e0e3', '#2ec7c9'],
          data: income.sort((a, b) => b.value - a.value),
          emphasis: {
            label: {
              fontSize: '14',
              fontWeight: 'bold',
              show: true,
            },
          },
          label: {
            formatter: '{b}\n{c}元',
            position: 'inside',
            show: true,
          },
          name: '收入占比',
          radius: '80%',
          roseType: 'radius',
          type: 'pie',
        },
      ],
      tooltip: { trigger: 'item' },
    });
  } catch (error) {
    console.error('加载收入占比数据失败:', error);
  }
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
