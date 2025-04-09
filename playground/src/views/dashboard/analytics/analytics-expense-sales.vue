<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getAnalyticsTotal } from '#/api/analytics';

const chartRef = ref<EchartsUIType>();
const loading = ref(true);
const { renderEcharts } = useEcharts(chartRef);

onMounted(async () => {
  try {
    loading.value = true;
    const { expense } = await getAnalyticsTotal();

    if (!expense?.length) {
      throw new Error('暂无数据');
    }

    // 数据预处理，使用 for...of 替代 sort
    const sortedData = [...expense];
    for (let i = 0; i < sortedData.length; i++) {
      for (let j = i + 1; j < sortedData.length; j++) {
        if (sortedData[j].value > sortedData[i].value) {
          [sortedData[i], sortedData[j]] = [sortedData[j], sortedData[i]];
        }
      }
    }

    renderEcharts({
      legend: {
        bottom: '2%',
        left: 'center',
        type: 'scroll',
      },
      series: [
        {
          animationDelay() {
            return Math.random() * 400;
          },
          animationEasing: 'exponentialInOut',
          animationType: 'scale',
          center: ['50%', '45%'],
          color: ['#5ab1ef', '#b6a2de', '#67e0e3', '#2ec7c9'],
          data: sortedData,
          emphasis: {
            label: {
              fontSize: '14',
              fontWeight: 'bold',
              show: true,
            },
          },
          label: {
            formatter: (params) => {
              const value = Number(params.value).toLocaleString();
              return `${params.name}\n${value}元`;
            },
            position: 'inside',
            show: true,
          },
          name: '支出占比',
          radius: '80%',
          roseType: 'radius',
          type: 'pie',
        },
      ],
      tooltip: {
        formatter: (params: any) => {
          if (!params?.value) return '';
          const value = Number(params.value).toLocaleString();
          return `${params.name || ''}: ${value}元 (${params.percent || 0}%)`;
        },
        trigger: 'item',
      },
    });
  } catch (error) {
    console.error('加载支出占比数据失败:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="relative h-full w-full">
    <div
      v-show="loading"
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60"
    >
      加载中...
    </div>
    <EchartsUI ref="chartRef" />
  </div>
</template>
