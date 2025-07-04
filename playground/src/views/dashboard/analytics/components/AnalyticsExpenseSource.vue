<script lang="ts" setup>
import BaseChart from './BaseChart.vue';
import { getCompareChartConfig } from './chartConfigs';

interface Props {
  data: any;
}
defineProps<Props>();
</script>

<template>
  <BaseChart
    :chart-config-fn="
      (data) =>
        getCompareChartConfig(
          data.currentMonth.expense,
          data.lastMonth.expense,
          'expense',
        )
    "
    :chart-data="data"
    :process-data-fn="(data) => data"
  />
</template>
