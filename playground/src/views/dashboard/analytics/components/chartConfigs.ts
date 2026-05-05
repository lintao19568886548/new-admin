import type { EChartsOption } from 'echarts';

const COLORS = {
  amount: '#019680',
  blue: '#5ab1ef',
  currentMonth: '#5ab1ef',
  cyan: '#67e0e3',
  expense: '#5ab1ef',
  green: '#91cc75',
  income: '#91cc75',
  lastMonth: '#91cc75',
  orange: '#fac858',
  pie: ['#5ab1ef', '#b6a2de', '#67e0e3', '#2ec7c9'],
  purple: '#b6a2de',
  red: '#ee6666',
  usage: '#5ab1ef',
};

function getSizeValue<T>(screenWidth: number, values: [T, T, T]) {
  if (screenWidth < 768) {
    return values[0];
  }
  if (screenWidth < 1024) {
    return values[1];
  }
  return values[2];
}

function getCompactPieLayout(screenWidth: number) {
  return {
    centerY: getSizeValue(screenWidth, ['40%', '42%', '44%']),
    gridInset: screenWidth < 768 ? '3%' : '5%',
    itemGap: getSizeValue(screenWidth, [4, 6, 12]),
    itemSize: getSizeValue(screenWidth, [6, 8, 14]),
    legendBottom: getSizeValue(screenWidth, [4, 6, 10]),
    legendFontSize: getSizeValue(screenWidth, [6, 7, 10]),
  };
}

/**
 * Type definition for park electricity data items.
 */
export interface ParkElectricityDataItem {
  parkName: string;
  tenants: {
    amount: number;
    tenantName: string;
    usage: number;
  }[];
  totalAmount: number;
  totalUsage: number;
}

/**
 * 园区电费图表配置生成函数
 */
export function getParkElectricityChartConfig(
  data: ParkElectricityDataItem[],
): EChartsOption {
  // 提取园区名称作为X轴数据
  const parkNames = data.map((item) => item.parkName);

  // 提取电度数和电费金额作为系列数据
  const usageData = data.map((item) => item.totalUsage);
  const amountData = data.map((item) => item.totalAmount);

  return {
    grid: {
      bottom: '3%',
      containLabel: true,
      left: '3%',
      right: '4%',
    },
    legend: {
      data: ['电度数', '电费金额'],
    },
    series: [
      {
        data: usageData,
        itemStyle: {
          color: COLORS.usage,
        },
        name: '电度数',
        type: 'bar',
      },
      {
        data: amountData,
        itemStyle: {
          color: COLORS.amount,
        },
        name: '电费金额',
        type: 'bar',
        yAxisIndex: 1,
      },
    ],
    tooltip: {
      axisPointer: {
        type: 'shadow',
      },
      formatter(params: any) {
        if (params?.length) {
          const parkData = data[params[0].dataIndex];
          if (parkData) {
            let html = `<div style="font-weight:bold;margin-bottom:5px">${parkData.parkName}</div>`;
            html += `<div>总电度数: ${parkData.totalUsage} 度</div>`;
            html += `<div>总电费: ${parkData.totalAmount} 元</div>`;

            // 添加租户详情
            if (parkData.tenants && parkData.tenants.length > 0) {
              html += `<div style="margin-top:5px;font-weight:bold">租户详情:</div>`;
              parkData.tenants.forEach((tenant) => {
                html += `<div>${tenant.tenantName}: ${tenant.usage}度 / ${tenant.amount}元</div>`;
              });
            }
            return html;
          }
        }
        return '';
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: 30,
      },
      data: parkNames,
      type: 'category',
    },
    yAxis: [
      {
        axisLabel: {
          formatter: '{value} 度',
        },
        name: '电度数',
        position: 'left',
        type: 'value',
      },
      {
        axisLabel: {
          formatter: '{value} 元',
        },
        name: '金额',
        position: 'right',
        type: 'value',
      },
    ],
  };
}

/**
 * 趋势图配置生成函数
 */
export function getTrendsChartConfig(data: {
  expenseData: number[];
  incomeData: number[];
}): EChartsOption {
  return {
    grid: {
      bottom: 0,
      containLabel: true,
      left: '1%',
      right: '1%',
      top: '2 %',
    },
    series: [
      {
        areaStyle: {},
        data: data.incomeData,
        itemStyle: {
          color: COLORS.income,
        },
        name: '收入',
        smooth: true,
        type: 'line',
      },
      {
        areaStyle: {},
        data: data.expenseData,
        itemStyle: {
          color: COLORS.expense,
        },
        name: '支出',
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: {
      axisPointer: {
        lineStyle: {
          color: COLORS.expense,
          width: 1,
        },
      },
      trigger: 'axis',
    },
    xAxis: {
      axisTick: {
        show: false,
      },
      boundaryGap: false,
      data: Array.from({ length: 30 }).map((_item, index) => `${index + 1}日`),
      type: 'category',
    },
    yAxis: {
      axisLine: {
        show: false,
      },
      type: 'value',
    },
  };
}

/**
 * 雷达图配置生成函数（支出/收入趋势）
 */
export function getRadarChartConfig(
  data: { name: string; value: number }[],
  type: 'expense' | 'income',
): EChartsOption {
  // 计算最大值，向上取整以获得更好的显示效果
  const values = data.map((item) => item.value);
  const maxValue = values.length > 0 ? Math.ceil(Math.max(...values) * 1.2) : 0;

  // 构建雷达图指标
  const indicator = data.map((item) => ({
    max: maxValue,
    name: item.name,
  }));

  const seriesName = type === 'income' ? '收入趋势' : '支出趋势';
  const color = type === 'income' ? COLORS.income : COLORS.expense;

  return {
    legend: {
      bottom: 0,
      data: [seriesName],
    },
    radar: {
      indicator,
      radius: '60%',
      splitNumber: 2,
    },
    series: [
      {
        areaStyle: {
          opacity: 0.8,
          shadowBlur: 10,
          shadowColor: 'rgba(0,0,0,0.2)',
          shadowOffsetX: 0,
          shadowOffsetY: 10,
        },
        data: [
          {
            itemStyle: {
              color,
            },
            name: seriesName,
            value: values,
          },
        ],
        itemStyle: {
          borderRadius: 10,
          borderWidth: 2,
        },
        symbolSize: 0,
        type: 'radar',
      },
    ],
    tooltip: {
      trigger: 'item',
    },
  };
}

/**
 * 饼图配置生成函数（支出/收入销售占比）
 */
export function getPieChartConfig(
  data: { name: string; value: number }[],
  type: 'expense' | 'income',
): EChartsOption {
  const seriesName = type === 'income' ? '收入占比' : '支出占比';

  return {
    legend: {
      bottom: '2%',
      left: 'center',
      type: 'scroll',
    },
    series: [
      {
        animationDelay() {
          return Math.random() * 400;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        center: ['50%', '45%'],
        color: COLORS.pie,
        data,
        emphasis: {
          label: {
            fontSize: '14',
            fontWeight: 'bold',
            show: true,
          },
        },
        label: {
          formatter: (params: any) => {
            const value = Number(params.value).toLocaleString();
            return `${params.name}\n${value}元`;
          },
          position: 'inside',
          show: true,
        },
        name: seriesName,
        radius: '80%',
        roseType: 'radius',
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        if (!params?.value) return '';
        const value = Number(params.value).toLocaleString();
        return `${params.name || ''}: ${value}元 (${params.percent || 0}%)`;
      },
      trigger: 'item',
    },
  };
}

/**
 * 环比图配置生成函数（支出/收入环比）
 */
export function getCompareChartConfig(
  currentMonth: { value: number },
  lastMonth: { value: number },
  type: 'expense' | 'income',
): EChartsOption {
  const prefix = type === 'income' ? '收入' : '支出';

  // 构建环比数据
  const chartData = [
    { name: `本月${prefix}`, value: currentMonth.value },
    { name: `上月${prefix}`, value: lastMonth.value },
  ];

  return {
    legend: {
      bottom: '2%',
      data: [`本月${prefix}`, `上月${prefix}`],
      left: 'center',
    },
    series: [
      {
        animationDelay() {
          return Math.random() * 100;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        avoidLabelOverlap: false,
        color: [COLORS.currentMonth, COLORS.lastMonth],
        data: chartData,
        emphasis: {
          label: {
            fontSize: '14',
            fontWeight: 'bold',
            show: true,
          },
        },
        itemStyle: {
          borderRadius: 10,
          borderWidth: 2,
        },
        label: {
          formatter: '{b}\n{c}元',
          position: 'inside',
          show: true,
        },
        labelLine: {
          show: false,
        },
        name: `${prefix}环比`,
        radius: ['40%', '65%'],
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c}元 ({d}%)',
      trigger: 'item',
    },
  };
}

/**
 * 月度柱状图配置生成函数
 */
export function getMonthlyChartConfig(data: {
  expenseDatamonths: number[] | string[];
  incomeDatamonths: number[] | string[];
}): EChartsOption {
  const expenseData = Array.isArray(data.expenseDatamonths)
    ? data.expenseDatamonths.map(Number)
    : [];
  const incomeData = Array.isArray(data.incomeDatamonths)
    ? data.incomeDatamonths.map(Number)
    : [];

  const allData = [...expenseData, ...incomeData];
  const maxValue =
    allData.length > 0 ? Math.ceil(Math.max(...allData) * 1.2) : 0;

  return {
    grid: {
      bottom: '15%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '5%',
    },
    legend: {
      bottom: 0,
      data: ['支出', '收入'],
      itemGap: 16,
    },
    series: [
      {
        barGap: 0.2,
        barMaxWidth: 80,
        color: COLORS.expense,
        data: expenseData,
        name: '支出',
        type: 'bar',
      },
      {
        barGap: 0.2,
        barMaxWidth: 80,
        color: COLORS.income,
        data: incomeData,
        name: '收入',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: {
        lineStyle: {
          width: 1,
        },
        type: 'shadow',
      },
      formatter: (params: any) => {
        if (!params) return '';

        const items = Array.isArray(params) ? params : [params];
        const month = items[0]?.name || '';

        let result = `${month}<br/>`;
        for (const item of items) {
          const value = Number(item.value || 0).toLocaleString();
          result += `${item.seriesName}: ${value}元<br/>`;
        }

        return result;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        interval: 0,
      },
      data: Array.from({ length: 12 }).map((_item, index) => `${index + 1}月`),
      type: 'category',
    },
    yAxis: {
      axisLine: {
        show: false,
      },
      max: maxValue,
      name: '金额',
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

export function getSemiPieChartConfig(
  data: { name: string; value: number }[],
  screenWidth = window.innerWidth,
): EChartsOption {
  const shouldShowLabel = screenWidth >= 1024;
  const fontSize = screenWidth < 768 ? 0 : 12;
  const labelDistance = shouldShowLabel ? 40 : 0;
  const lineLength1 = shouldShowLabel ? 10 : 0;
  const lineLength2 = shouldShowLabel ? 12 : 0;
  const mobileGridInset = screenWidth < 768 ? '5%' : '8%';
  const showLabel = shouldShowLabel;
  const showLabelLine = shouldShowLabel;
  const pieRadius = screenWidth < 768 ? '65%' : '55%';

  return {
    grid: {
      bottom: mobileGridInset,
      containLabel: true,
      left: mobileGridInset,
      right: mobileGridInset,
      top: mobileGridInset,
    },
    series: [
      {
        center: ['50%', '50%'],
        color: [COLORS.blue, COLORS.green],
        data,
        emphasis: {
          label: {
            fontSize: getSizeValue(screenWidth, [0, 11, 13]),
            show: showLabel,
          },
        },
        label: {
          align: 'center',
          alignTo: 'labelLine',
          distance: labelDistance,
          fontSize,
          formatter: '{b}: {c}',
          lineHeight: getSizeValue(screenWidth, [0, 13, 15]),
          overflow: 'none',
          padding: [2, 6],
          show: showLabel,
        },
        labelLayout: {
          hideOverlap: false,
          moveOverlap: 'shiftX',
        },
        labelLine: {
          length: lineLength1,
          length2: lineLength2,
          minTurnAngle: 30,
          show: showLabelLine,
          smooth: false,
        },
        name: '',
        radius: pieRadius,
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c} ({d}%)',
      trigger: 'item',
    },
  };
}

export function getContractTrendChartConfig(
  data: {
    dates: string[];
    expiring: number[];
    normal: number[];
    retreated: number[];
  },
  isMobile = false,
): EChartsOption {
  const legendFontSize = isMobile ? 9 : 11;

  return {
    grid: {
      bottom: isMobile ? '18%' : '12%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '10%',
    },
    legend: {
      bottom: 0,
      data: ['正常合同', '即将到期', '已退租'],
      itemGap: isMobile ? 8 : 12,
      textStyle: {
        fontSize: legendFontSize,
      },
    },
    series: [
      {
        data: data.normal,
        itemStyle: {
          color: COLORS.blue,
        },
        lineStyle: {
          width: 2,
        },
        name: '正常合同',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
      {
        data: data.expiring,
        itemStyle: {
          color: COLORS.green,
        },
        lineStyle: {
          width: 2,
        },
        name: '即将到期',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
      {
        data: data.retreated,
        itemStyle: {
          color: COLORS.red,
        },
        lineStyle: {
          width: 2,
        },
        name: '已退租',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        if (!params) return '';
        const items = Array.isArray(params) ? params : [params];
        const date = items[0]?.name || '';
        let result = `${date}<br/>`;
        for (const item of items) {
          result += `${item.marker}${item.seriesName}: ${item.value}<br/>`;
        }
        return result;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        rotate: 30,
      },
      data: data.dates,
      type: 'category',
    },
    yAxis: {
      axisLine: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

export function getRevenueChartConfig(
  data: {
    actual: number[];
    months: string[];
    pending: number[];
    received: number[];
  },
  isMobile = false,
): EChartsOption {
  const legendFontSize = isMobile ? 9 : 11;

  return {
    grid: {
      bottom: isMobile ? '20%' : '15%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '10%',
    },
    legend: {
      bottom: 0,
      data: ['实收总额', '已收总额', '待收总额'],
      textStyle: {
        fontSize: legendFontSize,
      },
    },
    series: [
      {
        barGap: 0.1,
        barMaxWidth: 30,
        color: COLORS.green,
        data: data.actual,
        name: '实收总额',
        type: 'bar',
      },
      {
        barGap: 0.1,
        barMaxWidth: 30,
        color: COLORS.blue,
        data: data.received,
        name: '已收总额',
        type: 'bar',
      },
      {
        barGap: 0.1,
        barMaxWidth: 30,
        color: COLORS.orange,
        data: data.pending,
        name: '待收总额',
        type: 'bar',
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        if (!params) return '';
        const items = Array.isArray(params) ? params : [params];
        const month = items[0]?.name || '';
        let result = `${month}<br/>`;
        for (const item of items) {
          const value = Number(item.value || 0).toLocaleString();
          result += `${item.marker}${item.seriesName}: ${value}元<br/>`;
        }
        return result;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        rotate: 30,
      },
      data: data.months,
      type: 'category',
    },
    yAxis: {
      axisLine: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

export function getEnergyConsumptionChartConfig(
  data: {
    electricity: number[];
    monthOnMonth: number[];
    months: string[];
    water: number[];
    yearOnYear: number[];
  },
  isMobile = false,
): EChartsOption {
  const legendFontSize = isMobile ? 9 : 11;

  return {
    grid: {
      bottom: isMobile ? '18%' : '12%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '8%',
    },
    legend: {
      bottom: 0,
      data: ['水', '电', '月环比', '月同比'],
      itemGap: isMobile ? 6 : 10,
      textStyle: {
        fontSize: legendFontSize,
      },
    },
    series: [
      {
        barGap: 0.1,
        barMaxWidth: 40,
        color: COLORS.blue,
        data: data.water,
        name: '水',
        type: 'bar',
      },
      {
        barGap: 0.1,
        barMaxWidth: 40,
        color: COLORS.green,
        data: data.electricity,
        name: '电',
        type: 'bar',
      },
      {
        data: data.monthOnMonth,
        lineStyle: {
          color: COLORS.orange,
          width: 2,
        },
        name: '月环比',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
        yAxisIndex: 1,
      },
      {
        data: data.yearOnYear,
        lineStyle: {
          color: COLORS.purple,
          width: 2,
        },
        name: '月同比',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
        yAxisIndex: 1,
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        if (!params) return '';
        const items = Array.isArray(params) ? params : [params];
        const month = items[0]?.name || '';
        let result = `${month}<br/>`;
        for (const item of items) {
          const value =
            item.seriesName.includes('环比') || item.seriesName.includes('同比')
              ? `${item.value}%`
              : item.value;
          result += `${item.marker}${item.seriesName}: ${value}<br/>`;
        }
        return result;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        rotate: 30,
      },
      data: data.months,
      type: 'category',
    },
    yAxis: [
      {
        axisLine: {
          show: false,
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
          },
        },
        type: 'value',
      },
      {
        axisLabel: {
          formatter: '{value}%',
        },
        axisLine: {
          show: false,
        },
        splitLine: {
          show: false,
        },
        type: 'value',
      },
    ],
  };
}

export function getWorkOrderChartConfig(
  data: { name: string; value: number }[],
  screenWidth = window.innerWidth,
): EChartsOption {
  const shouldShowLabel = screenWidth >= 1024;
  const layout = getCompactPieLayout(screenWidth);
  const fontSize = shouldShowLabel ? 11 : 0;
  const showLabel = shouldShowLabel;
  const showLabelLine = shouldShowLabel;

  return {
    grid: {
      bottom: screenWidth < 768 ? '6%' : '8%',
      containLabel: true,
      left: layout.gridInset,
      right: layout.gridInset,
      top: layout.gridInset,
    },
    legend: {
      bottom: layout.legendBottom,
      data: data.map((item) => item.name),
      itemGap: layout.itemGap,
      itemHeight: layout.itemSize,
      itemWidth: layout.itemSize,
      textStyle: {
        fontSize: layout.legendFontSize,
      },
    },
    series: [
      {
        center: ['50%', layout.centerY],
        color: [
          COLORS.blue,
          COLORS.green,
          COLORS.orange,
          COLORS.red,
          '#9C88FF',
        ],
        data,
        label: {
          align: 'center',
          distance: shouldShowLabel ? 22 : 0,
          fontSize,
          formatter: '{b}\n{d}%',
          lineHeight: shouldShowLabel ? 14 : 0,
          overflow: 'none',
          padding: [2, 4],
          show: showLabel,
        },
        labelLayout: {
          hideOverlap: false,
          moveOverlap: 'shiftX',
        },
        labelLine: {
          length: shouldShowLabel ? 10 : 0,
          length2: shouldShowLabel ? 12 : 0,
          minTurnAngle: 30,
          show: showLabelLine,
          smooth: false,
        },
        name: '工单状态',
        radius:
          screenWidth < 768
            ? ['30%', '52%']
            : getSizeValue(screenWidth, [
                ['30%', '52%'],
                ['32%', '55%'],
                ['40%', '68%'],
              ]),
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c} ({d}%)',
      trigger: 'item',
    },
  };
}

export function getCountStatisticsChartConfig(
  data: { name: string; value: number }[],
  screenWidth = window.innerWidth,
): EChartsOption {
  const shouldShowLabel = screenWidth >= 1024;
  const layout = getCompactPieLayout(screenWidth);
  const fontSize = shouldShowLabel ? 11 : 0;
  const showLabel = shouldShowLabel;
  const showLabelLine = shouldShowLabel;

  return {
    grid: {
      bottom: screenWidth < 768 ? '6%' : '8%',
      containLabel: true,
      left: layout.gridInset,
      right: layout.gridInset,
      top: layout.gridInset,
    },
    legend: {
      bottom: layout.legendBottom,
      data: data.map((item) => item.name),
      itemGap: layout.itemGap,
      itemHeight: layout.itemSize,
      itemWidth: layout.itemSize,
      textStyle: {
        fontSize: layout.legendFontSize,
      },
    },
    series: [
      {
        center: ['50%', layout.centerY],
        color: [COLORS.blue, COLORS.green],
        data,
        label: {
          align: 'center',
          distance: shouldShowLabel ? 20 : 0,
          fontSize,
          formatter: '{b}\n{d}%',
          lineHeight: shouldShowLabel ? 14 : 0,
          overflow: 'none',
          padding: [2, 4],
          show: showLabel,
        },
        labelLayout: {
          hideOverlap: false,
          moveOverlap: 'shiftX',
        },
        labelLine: {
          length: shouldShowLabel ? 8 : 0,
          length2: shouldShowLabel ? 10 : 0,
          minTurnAngle: 30,
          show: showLabelLine,
          smooth: false,
        },
        name: '统计',
        radius:
          screenWidth < 768
            ? ['30%', '52%']
            : getSizeValue(screenWidth, [
                ['30%', '52%'],
                ['32%', '55%'],
                ['38%', '62%'],
              ]),
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c} ({d}%)',
      trigger: 'item',
    },
  };
}

export function getCustomerTrendChartConfig(
  data: {
    activeCustomers: number[];
    dates: string[];
    lostCustomers: number[];
    negotiatingCustomers: number[];
    newCustomers: number[];
    totalCustomers: number[];
  },
  isMobile = false,
): EChartsOption {
  const legendFontSize = isMobile ? 9 : 11;

  return {
    grid: {
      bottom: isMobile ? '22%' : '16%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '10%',
    },
    legend: {
      bottom: 0,
      data: ['总客户数', '新增客户', '意向客户', '洽谈中', '流失客户'],
      itemGap: isMobile ? 6 : 10,
      textStyle: {
        fontSize: legendFontSize,
      },
    },
    series: [
      {
        data: data.totalCustomers,
        itemStyle: {
          color: COLORS.purple,
        },
        lineStyle: {
          width: 2,
        },
        name: '总客户数',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
      {
        data: data.newCustomers,
        itemStyle: {
          color: COLORS.green,
        },
        lineStyle: {
          width: 2,
        },
        name: '新增客户',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
      {
        data: data.activeCustomers,
        itemStyle: {
          color: COLORS.blue,
        },
        lineStyle: {
          width: 2,
        },
        name: '意向客户',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
      {
        data: data.negotiatingCustomers,
        itemStyle: {
          color: COLORS.orange,
        },
        lineStyle: {
          width: 2,
        },
        name: '洽谈中',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
      {
        data: data.lostCustomers,
        itemStyle: {
          color: COLORS.red,
        },
        lineStyle: {
          width: 2,
        },
        name: '流失客户',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        if (!params) return '';
        const items = Array.isArray(params) ? params : [params];
        const date = items[0]?.name || '';
        let result = `${date}<br/>`;
        for (const item of items) {
          result += `${item.marker}${item.seriesName}: ${item.value}<br/>`;
        }
        return result;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        rotate: 30,
      },
      data: data.dates,
      type: 'category',
    },
    yAxis: {
      axisLine: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}

export function getNegotiationProgressChartConfig(
  data: { name: string; value: number }[],
  screenWidth = window.innerWidth,
): EChartsOption {
  const shouldShowLabel = screenWidth >= 1024;
  const layout = getCompactPieLayout(screenWidth);
  const fontSize = shouldShowLabel ? 11 : 0;
  const showLabel = shouldShowLabel;
  const showLabelLine = shouldShowLabel;

  return {
    grid: {
      bottom: screenWidth < 768 ? '6%' : '8%',
      containLabel: true,
      left: layout.gridInset,
      right: layout.gridInset,
      top: layout.gridInset,
    },
    legend: {
      bottom: layout.legendBottom,
      data: data.map((item) => item.name),
      itemGap: layout.itemGap,
      itemHeight: layout.itemSize,
      itemWidth: layout.itemSize,
      textStyle: {
        fontSize: layout.legendFontSize,
      },
    },
    series: [
      {
        center: ['50%', layout.centerY],
        color: [COLORS.blue, COLORS.green, COLORS.orange, COLORS.red],
        data,
        label: {
          align: 'center',
          distance: shouldShowLabel ? 20 : 0,
          fontSize,
          formatter: '{b}\n{d}%',
          lineHeight: shouldShowLabel ? 14 : 0,
          overflow: 'none',
          padding: [2, 4],
          show: showLabel,
        },
        labelLayout: {
          hideOverlap: false,
          moveOverlap: 'shiftX',
        },
        labelLine: {
          length: shouldShowLabel ? 8 : 0,
          length2: shouldShowLabel ? 10 : 0,
          minTurnAngle: 30,
          show: showLabelLine,
          smooth: false,
        },
        name: '洽谈进度',
        radius:
          screenWidth < 768
            ? ['30%', '52%']
            : getSizeValue(screenWidth, [
                ['30%', '52%'],
                ['32%', '55%'],
                ['40%', '68%'],
              ]),
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c} ({d}%)',
      trigger: 'item',
    },
  };
}

export function getElectricityPieChartConfig(
  data: { itemStyle?: { color: string }; name: string; value: number }[],
  screenWidth = window.innerWidth,
): EChartsOption {
  const shouldShowLabel = screenWidth >= 1024;
  const layout = getCompactPieLayout(screenWidth);
  const fontSize = shouldShowLabel ? 11 : 0;
  const showLabel = shouldShowLabel;
  const showLabelLine = shouldShowLabel;

  return {
    grid: {
      bottom: screenWidth < 768 ? '6%' : '8%',
      containLabel: true,
      left: layout.gridInset,
      right: layout.gridInset,
      top: layout.gridInset,
    },
    legend: {
      bottom: layout.legendBottom,
      data: data.map((item) => item.name),
      itemGap: layout.itemGap,
      itemHeight: layout.itemSize,
      itemWidth: layout.itemSize,
      textStyle: {
        fontSize: layout.legendFontSize,
      },
    },
    series: [
      {
        center: ['50%', layout.centerY],
        data,
        label: {
          align: 'center',
          distance: shouldShowLabel ? 20 : 0,
          fontSize,
          formatter: '{b}: {c}kWh\n({d}%)',
          lineHeight: shouldShowLabel ? 14 : 0,
          overflow: 'none',
          padding: [2, 4],
          show: showLabel,
        },
        labelLayout: {
          hideOverlap: false,
          moveOverlap: 'shiftX',
        },
        labelLine: {
          length: shouldShowLabel ? 8 : 0,
          length2: shouldShowLabel ? 10 : 0,
          minTurnAngle: 30,
          show: showLabelLine,
          smooth: false,
        },
        name: '用电分布',
        radius:
          screenWidth < 768
            ? ['30%', '52%']
            : getSizeValue(screenWidth, [
                ['30%', '52%'],
                ['32%', '55%'],
                ['40%', '68%'],
              ]),
        type: 'pie',
      },
    ],
    tooltip: {
      formatter: '{b}: {c}kWh ({d}%)',
      trigger: 'item',
    },
  };
}

export function getDailyElectricityTrendChartConfig(
  data: {
    periods: string[];
    times: string[];
    values: number[];
  },
  isMobile = false,
): EChartsOption {
  return {
    grid: {
      bottom: isMobile ? '18%' : '12%',
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '10%',
    },
    series: [
      {
        data: data.values,
        itemStyle: {
          color: (params: any) => {
            const period = data.periods[params.dataIndex];
            switch (period) {
              case '尖': {
                return '#EF4444';
              }
              case '峰': {
                return '#F97316';
              }
              case '平': {
                return '#3B82F6';
              }
              case '谷': {
                return '#10B981';
              }
              default: {
                return '#6B7280';
              }
            }
          },
        },
        lineStyle: {
          width: 2,
        },
        name: '用电量',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        type: 'line',
      },
    ],
    tooltip: {
      formatter: (params: any) => {
        if (!params) return '';
        const period = data.periods[params.dataIndex] || '';
        const periodColors: Record<string, string> = {
          尖: '#EF4444',
          峰: '#F97316',
          平: '#3B82F6',
          谷: '#10B981',
        };
        const color = periodColors[period] || '#6B7280';
        return `${params.name}<br/>时间段: <span style="color: ${color}">${period}</span><br/>用电量: ${params.value}kWh`;
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        fontSize: isMobile ? 8 : 10,
        rotate: 30,
      },
      data: data.times,
      type: 'category',
    },
    yAxis: {
      axisLine: {
        show: false,
      },
      name: '用电量(kWh)',
      nameTextStyle: {
        fontSize: isMobile ? 8 : 10,
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      type: 'value',
    },
  };
}
