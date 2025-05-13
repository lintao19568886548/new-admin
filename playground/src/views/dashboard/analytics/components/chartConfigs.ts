import type { EChartsOption } from 'echarts';

/**
 * 园区电费图表配置生成函数
 */
export function getParkElectricityChartConfig(data: any[]): EChartsOption {
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
          color: '#5ab1ef',
        },
        name: '电度数',
        type: 'bar',
      },
      {
        data: amountData,
        itemStyle: {
          color: '#019680',
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
        const parkData = data[params[0].dataIndex];
        let html = `<div style="font-weight:bold;margin-bottom:5px">${parkData.parkName}</div>`;
        html += `<div>总电度数: ${parkData.totalUsage} 度</div>`;
        html += `<div>总电费: ${parkData.totalAmount} 元</div>`;

        // 添加租户详情
        if (parkData.tenants && parkData.tenants.length > 0) {
          html += `<div style="margin-top:5px;font-weight:bold">租户详情:</div>`;
          parkData.tenants.forEach((tenant: any) => {
            html += `<div>${tenant.tenantName}: ${tenant.usage}度 / ${tenant.amount}元</div>`;
          });
        }

        return html;
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
          color: '#5ab1ef',
        },
        name: '收入',
        smooth: true,
        type: 'line',
      },
      {
        areaStyle: {},
        data: data.expenseData,
        itemStyle: {
          color: '#019680',
        },
        name: '支出',
        smooth: true,
        type: 'line',
      },
    ],
    tooltip: {
      axisPointer: {
        lineStyle: {
          color: '#019680',
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
  const maxValue = Math.ceil(Math.max(...data.map((item) => item.value)) * 1.2);

  // 构建雷达图指标
  const indicator = data.map((item) => ({
    max: maxValue,
    name: item.name,
  }));

  const seriesName = type === 'income' ? '收入趋势' : '支出趋势';
  const color = '#5ab1ef';

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
            value: data.map((item) => item.value),
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
        color: ['#5ab1ef', '#b6a2de', '#67e0e3', '#2ec7c9'],
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
        color: ['#5ab1ef', '#91cc75'],
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
  // 数据预处理
  const expenseData = Array.isArray(data.expenseDatamonths)
    ? data.expenseDatamonths.map(Number)
    : [];
  const incomeData = Array.isArray(data.incomeDatamonths)
    ? data.incomeDatamonths.map(Number)
    : [];

  // Calculate max value for y-axis
  let maxValue = 0;
  for (const value of [...expenseData, ...incomeData]) {
    if (value > maxValue) {
      maxValue = value;
    }
  }
  maxValue = Math.ceil(maxValue * 1.2);

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
        color: '#5ab1ef',
        data: expenseData,
        name: '支出',
        type: 'bar',
      },
      {
        barGap: 0.2,
        barMaxWidth: 80,
        color: '#91cc75',
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
    yAxis: [
      {
        axisLine: {
          show: false,
        },
        name: '金额',
        splitLine: {
          lineStyle: {
            type: 'dashed',
          },
        },
        type: 'value',
      },
    ],
  };
}
