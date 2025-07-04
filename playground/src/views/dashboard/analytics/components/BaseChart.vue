<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  // 图表配置函数，接收数据并返回ECharts配置
  chartConfigFn: (data: any) => any;
  // 传递图表数据
  chartData?: any;
  // 数据处理函数
  processDataFn?: (data: any) => any;
  // 是否显示加载状态
  showLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  chartData: null,
  processDataFn: (data: any) => data,
  showLoading: true,
});

const chartRef = ref<EchartsUIType>();
const loading = ref(false);
const error = ref('');
const isDataEmpty = ref(false);
const { renderEcharts } = useEcharts(chartRef);

// 封装渲染逻辑
const renderChart = async (data: any) => {
  try {
    loading.value = props.showLoading;
    error.value = '';
    isDataEmpty.value = false;

    // 数据加工处理
    const processedData = props.processDataFn(data);

    // 检查数据是否为空
    if (
      processedData === null ||
      processedData === undefined ||
      (Array.isArray(processedData) && processedData.length === 0) ||
      (typeof processedData === 'object' &&
        Object.keys(processedData).length === 0)
    ) {
      isDataEmpty.value = true;
      loading.value = false;
      return;
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
};

// 暴露出图表实例和相关方法，以便父组件可以直接操作图表
defineExpose({
  chartRef,
  renderEcharts,
});

onMounted(() => {
  if (props.chartData) {
    renderChart(props.chartData);
  }
});

watch(
  () => props.chartData,
  (newData) => {
    if (newData) {
      renderChart(newData);
    }
  },
  { deep: true },
);
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
    <div
      v-if="isDataEmpty"
      class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-60"
    >
      暂无数据
    </div>
    <EchartsUI ref="chartRef" />
  </div>
</template>
