<script lang="ts" setup>
import { getAnalyticsTotal } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getPieChartConfig } from './chartConfigs';
</script>

<template>
  <BaseChart
    :chart-config-fn="(data) => getPieChartConfig(data, 'income')"
    :fetch-data-fn="getAnalyticsTotal"
    :process-data-fn="
      (data) =>
        data?.income?.length
          ? [...data.income].sort((a, b) => b.value - a.value)
          : []
    "
  />
</template>
