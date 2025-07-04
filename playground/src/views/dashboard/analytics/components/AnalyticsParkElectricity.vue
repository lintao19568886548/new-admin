<script lang="ts" setup>
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

interface Props {
  data: ParkElectricityData[];
}
defineProps<Props>();

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
    :chart-data="data"
    :process-data-fn="processData"
  />
</template>
