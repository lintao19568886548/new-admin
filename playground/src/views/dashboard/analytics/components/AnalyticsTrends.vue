<script lang="ts" setup>
import BaseChart from './BaseChart.vue';
import { getTrendsChartConfig } from './chartConfigs';

interface Props {
  data: any;
}

defineProps<Props>();
</script>

<template>
  <BaseChart :chart-config-fn="getTrendsChartConfig" :chart-data="data" />
</template>
