<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(() => {
  renderEcharts({
    series: [
      {
        animationDelay() {
          return Math.random() * 400;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        center: ['50%', '50%'],
        color: ['#b6a2de', '#67e0e3', '#2ec7c9', '#5ab1ef'],
        data: [
          { name: '人工支出', value: 600 },
          { name: '运营支出', value: 420 },
          { name: '维护支出', value: 380 },
          { name: '其它支出', value: 220 },
        ].sort((a, b) => {
          return a.value - b.value;
        }),
        name: '支出占比',
        radius: '80%',
        roseType: 'radius',
        type: 'pie',
      },
    ],
    tooltip: {
      trigger: 'item',
    },
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
