<script lang="ts" setup>
import { getAnalyticsTrend } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getRadarChartConfig } from './chartConfigs';
</script>

<template>
  <BaseChart
    :chart-config-fn="(data) => getRadarChartConfig(data, 'income')"
    :fetch-data-fn="getAnalyticsTrend"
    :process-data-fn="(data) => data.income"
  />
</template>
