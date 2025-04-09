<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getAnalyticsMonth } from '#/api/analytics';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(async () => {
  try {
    const { currentMonth, lastMonth } = await getAnalyticsMonth();

    // 构建环比数据
    const chartData = [
      { name: '本月收入', value: currentMonth.income.value },
      { name: '上月收入', value: lastMonth.income.value },
    ];

    renderEcharts({
      legend: {
        bottom: '2%',
        data: ['本月收入', '上月收入'],
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
          data: chartData,
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
        formatter: '{b}: {c}元 ({d}%)',
        trigger: 'item',
      },
    });
  } catch (error) {
    console.error('加载收入环比数据失败:', error);
  }
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
