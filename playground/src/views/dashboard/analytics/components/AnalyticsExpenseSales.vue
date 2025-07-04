<script lang="ts" setup>
import BaseChart from './BaseChart.vue';
import { getPieChartConfig } from './chartConfigs';

interface Props {
  data: any;
}
defineProps<Props>();
</script>

<template>
  <BaseChart
    :chart-config-fn="(data) => getPieChartConfig(data, 'expense')"
    :chart-data="data"
    :process-data-fn="
      (data) =>
        data?.expense?.length
          ? [...data.expense].sort((a, b) => b.value - a.value)
          : []
    "
  />
</template>
