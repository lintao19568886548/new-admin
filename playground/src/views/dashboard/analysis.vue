<script lang="ts" setup>
import type { Ref } from 'vue';

import { h, onMounted, ref } from 'vue';

// 引入项目中已有的图表组件
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  Button,
  Card,
  Col,
  Row,
  Select,
  Statistic,
  Table,
} from 'ant-design-vue';

import {
  getAnalyticsTotal,
  getAnalyticsTrend,
} from '#/api/analytics/analytics';
import { getFinanceList } from '#/api/finance/finance';
import { getInvestmentList } from '#/api/investment/investment';
import { getTenantList } from '#/api/rental/tenant';
import {
  exportToExcel,
  exportToPDF,
  generateReportSummary,
} from '#/utils/report-export';

import {
  getPieChartConfig,
  getTrendsChartConfig,
} from './analytics/components/chartConfigs';

// 定义类型
interface KpiData {
  change?: number;
  color?: string;
  label: string;
  value: number;
}

interface ChartData {
  sales: number;
  type: string;
}

interface InvestmentData {
  agentName: string;
  intentArea?: number;
  intentLevel: string;
  investmentId?: number;
  meetingTime: string;
  parkId: number;
  parkName?: string;
  phoneNumber: string;
  progress: string;
  remark?: string;
  tenantName: string;
  // 根据实际API返回的字段进行调整
}

interface TenantData {
  address?: string;
  contractEnd?: string;
  id: number;
  paymentRate?: number;
  paymentStatus?: number;
  phoneNumber: string;
  rentArea?: number;
  rentPrice?: number;
  status?: string;
  tenantName: string;
  // 根据实际API返回的字段进行调整
}

interface FinanceData {
  amount: number;
  billCategory: string;
  id: number;
  transactionTime: string;
  transactionType: string;
}

interface AttendanceData {
  absentCount: number;
  attendanceRate: number;
  presentCount: number;
  totalEmployees: number;
}

// 响应式数据
const kpiData: Ref<KpiData[]> = ref([]);
const incomeData: Ref<ChartData[]> = ref([]);
const expenseData: Ref<ChartData[]> = ref([]);
const investmentData: Ref<InvestmentData[]> = ref([]);
const tenantData: Ref<TenantData[]> = ref([]);
const financeData: Ref<FinanceData[]> = ref([]);
const attendanceData: Ref<AttendanceData> = ref({
  absentCount: 0,
  attendanceRate: 0,
  presentCount: 0,
  totalEmployees: 0,
});

const loading = ref(true);
const timeRange = ref('month');
const selectedPark = ref('all');

// 图表配置
const incomeExpenseChartRef = ref();
const incomeTrendChartRef = ref();
const rentCollectionChartRef = ref();

// 模拟数据获取
const fetchData = async () => {
  loading.value = true;
  try {
    // 获取KPI数据
    const [totalRes, , investmentRes, tenantRes, financeRes] =
      await Promise.all([
        getAnalyticsTotal(),
        getAnalyticsTrend(),
        getInvestmentList({ pageNo: 1, pageSize: 10 }),
        getTenantList({ currentPage: 1, pageSize: 10 }),
        getFinanceList({ currentPage: 1, pageSize: 10 }),
      ]);

    // 处理KPI数据
    kpiData.value = [
      {
        change: 2.5,
        color: '#3f8600',
        label: '招商完成率',
        value: 85.5,
      },
      {
        change: -1.2,
        color: '#1890ff',
        label: '租金收缴率',
        value: 92.3,
      },
      {
        change: 5.3,
        color: '#ff4d4f',
        label: '能耗成本',
        value: 125_000,
      },
      {
        change: 0.5,
        color: '#722ed1',
        label: '人员出勤率',
        value: 98,
      },
    ];

    // 处理收入支出数据
    incomeData.value = totalRes.income || [];
    expenseData.value = totalRes.expense || [];

    // 处理招商数据
    investmentData.value = (investmentRes.items || []).map((item: any) => item);

    // 处理租户数据
    tenantData.value = (tenantRes.items || []).map((item: any) => item);

    // 处理财务数据
    financeData.value = financeRes.items || [];

    // 处理考勤数据（使用模拟数据）
    attendanceData.value = {
      absentCount: 2,
      attendanceRate: 98.3,
      presentCount: 118,
      totalEmployees: 120,
    };

    // 渲染图表
    renderIncomeExpenseChart();
    renderIncomeTrendChart();
    renderRentCollectionChart();
  } catch (error) {
    console.error('获取数据失败:', error);
  } finally {
    loading.value = false;
  }
};

// 渲染收入支出对比图
const renderIncomeExpenseChart = () => {
  const { renderEcharts } = useEcharts(incomeExpenseChartRef);
  const chartData = {
    expenseData: expenseData.value.map((item: any) => item.value || 0),
    incomeData: incomeData.value.map((item: any) => item.value || 0),
  };
  const chartConfig = getTrendsChartConfig(chartData);
  renderEcharts(chartConfig);
};

// 渲染收入趋势图
const renderIncomeTrendChart = () => {
  const { renderEcharts } = useEcharts(incomeTrendChartRef);
  const chartData = {
    expenseData: Array.from(
      { length: 12 },
      () => Math.floor(Math.random() * 5000) + 3000,
    ),
    incomeData: Array.from(
      { length: 12 },
      () => Math.floor(Math.random() * 10_000) + 5000,
    ),
  };
  const chartConfig = getTrendsChartConfig(chartData);
  renderEcharts(chartConfig);
};

// 渲染租金收缴图表
const renderRentCollectionChart = () => {
  const { renderEcharts } = useEcharts(rentCollectionChartRef);
  const chartData = incomeData.value.map((item: any) => ({
    name: item.name || '',
    value: item.value || 0,
  }));
  const chartConfig = getPieChartConfig(chartData, 'income'); // 使用收入类型的饼图
  renderEcharts(chartConfig);
};

// 时间范围变化处理
const handleTimeRangeChange = (value: string) => {
  timeRange.value = value;
  fetchData();
};

// 园区选择变化处理
const handleParkChange = (value: string) => {
  selectedPark.value = value;
  fetchData();
};

// 导出报告
const handleExportReport = (type: 'excel' | 'pdf') => {
  if (type === 'excel') {
    // 准备导出数据
    const reportData = generateReportSummary(
      kpiData.value.map((k) => ({ label: k.label, value: k.value })),
      investmentData.value,
      tenantData.value,
    );

    // 导出汇总数据
    exportToExcel(
      [reportData],
      `数据分析报告_${new Date().toISOString().slice(0, 10)}`,
    );
  } else {
    // PDF导出功能需要额外的库支持
    exportToPDF(
      'dashboard-content',
      `数据分析报告_${new Date().toISOString().slice(0, 10)}`,
    );
  }
};

// 多维度钻取处理
const handleDrillDown = (
  _level: 'building' | 'equipment' | 'park' | 'tenant',
  id?: number,
) => {
  console.warn(`钻取到${_level}级别，ID: ${id}`);
  // 这里可以实现具体的钻取逻辑
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div id="dashboard-content" class="p-2 sm:p-4">
    <!-- 核心仪表盘 -->
    <div class="mb-4">
      <Card>
        <div
          class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <h2 class="text-base font-semibold sm:text-lg">核心指标仪表盘</h2>
          <div class="flex flex-wrap gap-2">
            <Select
              v-model:value="timeRange"
              style="width: 100px; min-width: 100px"
              size="small"
              @change="(value) => handleTimeRangeChange(value as string)"
            >
              <Select.Option value="day">今日</Select.Option>
              <Select.Option value="week">本周</Select.Option>
              <Select.Option value="month">本月</Select.Option>
              <Select.Option value="quarter">本季度</Select.Option>
              <Select.Option value="year">本年度</Select.Option>
            </Select>
            <Select
              v-model:value="selectedPark"
              style="width: 120px; min-width: 100px"
              size="small"
              @change="(value) => handleParkChange(value as string)"
            >
              <Select.Option value="all">全部园区</Select.Option>
              <Select.Option value="park1">园区A</Select.Option>
              <Select.Option value="park2">园区B</Select.Option>
              <Select.Option value="park3">园区C</Select.Option>
            </Select>
            <Select
              v-model:value="timeRange"
              style="width: 100px; min-width: 100px"
              size="small"
            >
              <Select.Option value="daily">日报</Select.Option>
              <Select.Option value="weekly">周报</Select.Option>
              <Select.Option value="monthly">月报</Select.Option>
            </Select>
            <Button
              @click="handleExportReport('pdf')"
              type="primary"
              size="small"
              class="whitespace-nowrap"
            >
              导出PDF
            </Button>
            <Button
              @click="handleExportReport('excel')"
              size="small"
              class="whitespace-nowrap"
            >
              导出Excel
            </Button>
          </div>
        </div>

        <Row :gutter="[8, 8]" :xs="1" :sm="2" :md="2" :lg="4">
          <Col :span="6" v-for="(kpi, index) in kpiData" :key="index">
            <Card :bordered="false">
              <Statistic
                :value="kpi.value"
                :precision="kpi.value < 100 ? 1 : 0"
                :value-style="{
                  color: kpi.color,
                  fontSize: '16px',
                  lineHeight: '20px',
                }"
                :suffix="
                  kpi.label.includes('%')
                    ? '%'
                    : kpi.label.includes('率')
                      ? '%'
                      : ''
                "
              >
                <template #title>
                  <div class="flex items-center justify-between">
                    <span class="text-sm">{{ kpi.label }}</span>
                    <span
                      :style="{
                        color:
                          kpi.change && kpi.change >= 0 ? '#3f8600' : '#cf1322',
                      }"
                      class="text-xs"
                    >
                      {{
                        kpi.change
                          ? `${
                              (kpi.change >= 0 ? '↑' : '↓') +
                              Math.abs(kpi.change)
                            }%`
                          : ''
                      }}
                    </span>
                  </div>
                </template>
              </Statistic>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>

    <!-- 数据可视化区域 -->
    <div class="mb-4 grid grid-cols-1 gap-4">
      <!-- 收入支出对比图 -->
      <Card title="收入支出对比">
        <div style="height: 300px; min-height: 250px">
          <EchartsUI ref="incomeExpenseChartRef" />
        </div>
      </Card>

      <!-- 收入趋势图 -->
      <Card title="收入趋势">
        <div style="height: 300px; min-height: 250px">
          <EchartsUI ref="incomeTrendChartRef" />
        </div>
      </Card>
    </div>

    <!-- 招商和租户数据 -->
    <div class="mb-4 grid grid-cols-1 gap-4">
      <!-- 招商完成情况 -->
      <Card title="招商完成情况">
        <div class="max-h-64 overflow-y-auto sm:max-h-96">
          <Table
            :columns="[
              {
                title: '租户名称',
                dataIndex: 'tenantName',
                key: 'tenantName',
                width: 120,
                ellipsis: true,
              },
              {
                title: '中介名称',
                dataIndex: 'agentName',
                key: 'agentName',
                width: 100,
                ellipsis: true,
              },
              {
                title: '意向等级',
                dataIndex: 'intentLevel',
                key: 'intentLevel',
                width: 80,
              },
              {
                title: '意向面积',
                dataIndex: 'intentArea',
                key: 'intentArea',
                width: 80,
                customRender: ({ text }) => (text ? `${text}㎡` : '-'),
              },
              {
                title: '进展阶段',
                key: 'progress',
                width: 100,
                customRender: ({ record }) => {
                  const color =
                    record.progress === '签约完成'
                      ? '#52c41a'
                      : record.progress === '合同准备'
                        ? '#1890ff'
                        : record.progress === '深入沟通'
                          ? '#faad14'
                          : '#d9d9d9';
                  return h('span', { style: { color } }, record.progress);
                },
              },
            ]"
            :data-source="investmentData"
            :pagination="false"
            row-key="investmentId"
            size="small"
          />
        </div>
      </Card>

      <!-- 租金收缴情况 -->
      <Card title="租金收缴情况">
        <div class="max-h-64 overflow-y-auto sm:max-h-96">
          <Table
            :columns="[
              {
                title: '租户名称',
                dataIndex: 'tenantName',
                key: 'tenantName',
                width: 120,
                ellipsis: true,
              },
              {
                title: '联系电话',
                dataIndex: 'phoneNumber',
                key: 'phoneNumber',
                width: 120,
                ellipsis: true,
              },
              {
                title: '合同状态',
                key: 'status',
                width: 80,
                customRender: ({ record }) => {
                  const color =
                    record.status === 'active' ? '#52c41a' : '#f5222d';
                  return h(
                    'span',
                    { style: { color } },
                    record.status === 'active' ? '生效中' : '已过期',
                  );
                },
              },
              {
                title: '操作',
                key: 'action',
                width: 80,
                customRender: ({ record }) =>
                  h(
                    Button,
                    {
                      type: 'link',
                      size: 'small',
                      onClick: () => handleDrillDown('tenant', record.id),
                    },
                    () => '详情',
                  ),
              },
            ]"
            :data-source="tenantData"
            :pagination="false"
            row-key="id"
            size="small"
          />
        </div>
      </Card>
    </div>

    <!-- 能耗和人员情况 -->
    <div class="grid grid-cols-1 gap-4">
      <!-- 租金收缴情况饼图 -->
      <Card title="租金收缴分布">
        <div style="height: 300px; min-height: 250px">
          <EchartsUI ref="rentCollectionChartRef" />
        </div>
      </Card>

      <!-- 人员出勤情况 -->
      <Card title="人员出勤情况">
        <div class="flex h-48 items-center justify-center sm:h-64">
          <div class="text-center">
            <div class="mb-2 text-3xl font-bold text-blue-600">
              {{ attendanceData.attendanceRate }}%
            </div>
            <div class="mb-4 text-gray-600">总体出勤率</div>
            <div class="grid grid-cols-3 gap-4">
              <div class="rounded bg-blue-50 p-3">
                <div class="text-xl font-bold text-blue-600">
                  {{ attendanceData.totalEmployees }}
                </div>
                <div class="text-xs text-gray-600">总人数</div>
              </div>
              <div class="rounded bg-green-50 p-3">
                <div class="text-xl font-bold text-green-600">
                  {{ attendanceData.presentCount }}
                </div>
                <div class="text-xs text-gray-600">出勤</div>
              </div>
              <div class="rounded bg-red-50 p-3">
                <div class="text-xl font-bold text-red-600">
                  {{ attendanceData.absentCount }}
                </div>
                <div class="text-xs text-gray-600">缺勤</div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
:deep(.ant-card-head-title) {
  padding: 8px 0;
  font-size: 14px !important;
  font-weight: 600;
}

:deep(.ant-card) {
  margin-bottom: 12px;
}

:deep(.ant-table-wrapper) {
  padding: 0;
}

:deep(.ant-progress-text) {
  color: inherit;
}

:deep(.ant-statistic-content) {
  white-space: nowrap;
}

:deep(.ant-select-single .ant-select-selector) {
  height: 28px !important;
}

:deep(.ant-select-single .ant-select-selection-item) {
  line-height: 26px !important;
}

:deep(.ant-btn) {
  height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

@media (max-width: 640px) {
  :deep(.ant-card-body) {
    padding: 12px !important;
  }

  :deep(.ant-table-container) {
    font-size: 12px;
  }

  :deep(.ant-table-thead > tr > th),
  :deep(.ant-table-tbody > tr > td) {
    padding: 4px;
  }
}
</style>
