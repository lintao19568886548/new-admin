<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getAnalyticsTrend } from '#/api/analytics';

const chartRef = ref<EchartsUIType>();
const loading = ref(true);
const { renderEcharts } = useEcharts(chartRef);

onMounted(async () => {
  try {
    loading.value = true;
    const { expense } = await getAnalyticsTrend();

    if (!expense?.length) {
      throw new Error('暂无数据');
    }

    // 计算最大值，向上取整以获得更好的显示效果
    const maxValue = Math.ceil(
      Math.max(...expense.map((item: { value: number }) => item.value)) * 1.2,
    );

    // 构建雷达图指标
    const indicator = expense.map((item: { name: string; value: number }) => ({
      max: maxValue,
      name: item.name,
    }));

    renderEcharts({
      legend: {
        bottom: 0,
        data: ['支出趋势'],
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
              name: '支出趋势',
              value: expense.map((item: { value: number }) => item.value),
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
      tooltip: {
        trigger: 'item',
      },
    });
  } catch (error) {
    console.error('加载支出趋势数据失败:', error);
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
