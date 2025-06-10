<script lang="ts" setup>
import { getAnalyticsParkElectricity } from '#/api/analytics';

import BaseChart from './BaseChart.vue';
import { getParkElectricityChartConfig } from './chartConfigs';

interface ParkElectricityData {
  parkId: number;
  parkName: string;
  tenants: {
    amount: number;
    tenantId: number;
    tenantName: string;
    usage: number;
  }[];
  totalAmount: number;
  totalUsage: number;
}

// 定义数据获取函数
const fetchData = async () => {
  return await getAnalyticsParkElectricity();
};

// 数据处理函数
const processData = (data: ParkElectricityData[]) => {
  return data;
};

// 生成图表配置函数
const generateChartConfig = (data: ParkElectricityData[]) => {
  return getParkElectricityChartConfig(data);
};
</script>

<template>
  <BaseChart
    :chart-config-fn="generateChartConfig"
    :fetch-data-fn="fetchData"
    :process-data-fn="processData"
  />
</template>
