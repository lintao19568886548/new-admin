<script lang="ts" setup>
import { getAnalyticsMonth } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getCompareChartConfig } from './chartConfigs';
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
    :fetch-data-fn="getAnalyticsMonth"
    :process-data-fn="(data) => data"
  />
</template>
