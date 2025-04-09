<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { getAnalyticsData } from '#/api/analytics';

const chartRef = ref<EchartsUIType>();
const loading = ref(true);
const { renderEcharts } = useEcharts(chartRef);

onMounted(async () => {
  try {
    loading.value = true;
    const params = {
      type: 'months' as const,
    };
    const { expenseDatamonths, incomeDatamonths } =
      await getAnalyticsData(params);

    // 数据预处理
    const expenseData = expenseDatamonths?.map(Number) || [];
    const incomeData = incomeDatamonths?.map(Number) || [];

    if (expenseData.length === 0 && incomeData.length === 0) {
      throw new Error('暂无数据');
    }

    // Calculate max value for y-axis
    let maxValue = 0;
    for (const value of [...expenseData, ...incomeData]) {
      if (value > maxValue) {
        maxValue = value;
      }
    }
    maxValue = Math.ceil(maxValue * 1.2);

    renderEcharts({
      grid: {
        bottom: '15%',
        containLabel: true,
        left: '3%',
        right: '3%',
        top: '5%',
      },
      legend: {
        bottom: 0,
        data: ['支出', '收入'],
        itemGap: 16,
      },
      series: [
        {
          barGap: 0.2,
          barMaxWidth: 80,
          color: '#5ab1ef',
          data: expenseData,
          name: '支出',
          type: 'bar',
        },
        {
          barGap: 0.2,
          barMaxWidth: 80,
          color: '#91cc75',
          data: incomeData,
          name: '收入',
          type: 'bar',
        },
      ],
      tooltip: {
        axisPointer: {
          lineStyle: {
            width: 1,
          },
          type: 'shadow',
        },
        formatter: (params) => {
          if (!params) return '';

          const items = Array.isArray(params) ? params : [params];
          const month = items[0]?.name || '';

          let result = `${month}<br/>`;
          for (const item of items) {
            const value = Number(item.value || 0).toLocaleString();
            result += `${item.seriesName}: ${value}元<br/>`;
          }

          return result;
        },
        trigger: 'axis',
      },
      xAxis: {
        axisLabel: {
          interval: 0,
        },
        data: Array.from({ length: 12 }).map(
          (_item, index) => `${index + 1}月`,
        ),
        type: 'category',
      },
      yAxis: {
        axisLabel: {
          formatter: (value) => `${value.toLocaleString()}元`,
        },
        max: maxValue,
        splitNumber: 4,
        type: 'value',
      },
    });
  } catch (error) {
    console.error('加载收支数据失败:', error);
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
