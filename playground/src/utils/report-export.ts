/**
 * 导出数据为CSV文件（作为Excel的替代方案）
 * @param data - 要导出的数据
 * @param fileName - 文件名
 */
export function exportToExcel(data: any[], fileName: string) {
  if (data.length === 0) return;

  // 获取表头
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => `"${row[header] ?? ''}"`).join(','),
    ),
  ].join('\n');

  // 创建Blob并下载
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';

  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * 导出为PDF（使用html2canvas和jspdf）
 * @param elementId - 要导出的DOM元素ID
 * @param fileName - 文件名
 */
export async function exportToPDF(elementId?: string, fileName?: string) {
  if (typeof window === 'undefined') {
    console.warn('PDF导出功能仅在浏览器环境中可用');
    return;
  }

  try {
    // 动态导入依赖库
    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const html2canvas = html2canvasModule.default;
    const { jsPDF: JsPDF } = jsPDFModule;

    const element = document.querySelector(
      `#${elementId || ''}`,
    ) as HTMLElement | null;
    if (!element) {
      console.warn(`找不到ID为 ${elementId} 的元素`);
      return;
    }

    // 添加等待时间确保内容渲染完成
    await new Promise((resolve) => setTimeout(resolve, 500));

    const canvas = await html2canvas(element, {
      logging: false,
      scale: 2, // 提高清晰度
      useCORS: true, // 允许跨域图片
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new JsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4宽度
    const pageHeight = 295; // A4高度
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // 添加第一页
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // 如果内容超过一页，则添加新页
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${fileName || 'report'}.pdf`);
  } catch (error: any) {
    console.error('PDF导出失败:', error.message || error);
    console.warn('请确保已安装依赖: pnpm install html2canvas jspdf');
  }
}

/**
 * 生成报告数据摘要
 * @param kpiData - KPI数据
 * @param investmentData - 招商数据
 * @param tenantData - 租户数据
 * @returns 报告摘要
 */
export function generateReportSummary(
  kpiData: Array<{ label: string; value: number }>,
  investmentData: any[],
  tenantData: any[],
) {
  const summary = {
    investmentSummary: {
      completedProjects: investmentData.filter(
        (item) => item.progress === '签约完成',
      ).length,
      completionRate:
        investmentData.length > 0
          ? (
              (investmentData.filter((item) => item.progress === '签约完成')
                .length /
                investmentData.length) *
              100
            ).toFixed(2)
          : 0,
      totalProjects: investmentData.length,
    },
    kpiSummary: kpiData.map((kpi) => ({
      name: kpi.label,
      value: kpi.value,
    })),
    reportDate: new Date().toLocaleDateString('zh-CN'),
    tenantSummary: {
      activeTenants: tenantData.filter((item) => item.status === 'active')
        .length,
      contractRate:
        tenantData.length > 0
          ? (
              (tenantData.filter((item) => item.status === 'active').length /
                tenantData.length) *
              100
            ).toFixed(2)
          : 0,
      totalTenants: tenantData.length,
    },
  };

  return summary;
}
