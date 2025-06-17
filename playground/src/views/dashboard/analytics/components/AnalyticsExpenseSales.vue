<script lang="ts" setup>
import { getAnalyticsTotal } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getPieChartConfig } from './chartConfigs';
</script>

<template>
  <BaseChart
    :chart-config-fn="(data) => getPieChartConfig(data, 'expense')"
    :fetch-data-fn="getAnalyticsTotal"
    :process-data-fn="
      (data) =>
        data?.expense?.length
          ? [...data.expense].sort((a, b) => b.value - a.value)
          : []
    "
  />
</template>
