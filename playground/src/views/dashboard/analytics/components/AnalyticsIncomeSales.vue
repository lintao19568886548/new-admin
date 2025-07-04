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
    :chart-config-fn="(data) => getPieChartConfig(data, 'income')"
    :chart-data="data"
    :process-data-fn="
      (data) =>
        data?.income?.length
          ? [...data.income].sort((a, b) => b.value - a.value)
          : []
    "
  />
</template>
