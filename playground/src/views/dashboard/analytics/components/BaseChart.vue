<script lang="ts" setup>
import type { EChartsOption } from 'echarts';

import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  // 图表配置函数，接收数据并返回ECharts配置
  chartConfigFn: (data: any) => EChartsOption;
  // 数据获取函数
  fetchDataFn: () => Promise<any>;
  // 数据处理函数
  processDataFn?: (data: any) => any;
  // 是否显示加载状态
  showLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  processDataFn: (data) => data,
  showLoading: true,
});

const chartRef = ref<EchartsUIType>();
const loading = ref(false);
const error = ref('');
const { renderEcharts } = useEcharts(chartRef);

// 暴露出图表实例和相关方法，以便父组件可以直接操作图表
defineExpose({
  chartRef,
  renderEcharts,
});

onMounted(async () => {
  try {
    loading.value = props.showLoading;
    error.value = '';

    // 获取数据
    const data = await props.fetchDataFn();

    // 数据加工处理
    const processedData = props.processDataFn(data);

    // Check if processedData is effectively empty for charting
    let isEmptyData = false;
    if (processedData === null || processedData === undefined) {
      isEmptyData = true;
    } else if (Array.isArray(processedData) && processedData.length === 0) {
      // Consider an empty array as a "no data" scenario for these charts
      isEmptyData = true;
    }

    if (isEmptyData) {
      throw new Error('暂无数据');
    }

    // 生成图表配置并渲染
    const chartConfig = props.chartConfigFn(processedData);
    await renderEcharts(chartConfig);
  } catch (error_) {
    console.error('图表渲染失败:', error_);
    error.value = error_ instanceof Error ? error_.message : '加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="relative h-full w-full">
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60"
    >
      加载中...
    </div>
    <div
      v-if="error"
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60"
    >
      {{ error }}
    </div>
    <EchartsUI ref="chartRef" />
  </div>
</template>
