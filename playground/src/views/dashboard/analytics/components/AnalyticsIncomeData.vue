<script lang="ts" setup>
import BaseChart from './BaseChart.vue';
import { getRadarChartConfig } from './chartConfigs';

interface Props {
  data: any;
}
defineProps<Props>();
</script>

<template>
  <BaseChart
    :chart-config-fn="(data) => getRadarChartConfig(data, 'income')"
    :chart-data="data"
    :process-data-fn="(data) => data.income"
  />
</template>
