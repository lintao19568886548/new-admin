import type { WorkBook, WorkSheet } from 'xlsx';

import * as XLSX from 'xlsx';

/**
 * 将二维数组数据导出为Excel文件
 * @param data 二维数组数据
 * @param fileName 导出的文件名
 * @param sheetName 工作表名称
 */
export function exportArrayToExcel(
  data: any[][],
  fileName: string = 'excel-export',
  sheetName: string = 'Sheet1',
) {
  // 创建工作簿
  const wb: WorkBook = XLSX.utils.book_new();
  // 将数组转换为工作表
  const ws: WorkSheet = XLSX.utils.aoa_to_sheet(data);
  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // 写入文件并下载
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * 将JSON数据导出为Excel文件
 * @param data 要导出的数据
 * @param fileName 导出的文件名
 * @param sheetName 工作表名称
 */
export function exportJsonToExcel<T = any>(
  data: T[],
  fileName: string = 'excel-export',
  sheetName: string = 'Sheet1',
) {
  // 创建工作簿
  const wb: WorkBook = XLSX.utils.book_new();
  // 将JSON数据转换为工作表
  const ws: WorkSheet = XLSX.utils.json_to_sheet(data);
  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // 写入文件并下载
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * 将表格数据导出为Excel文件
 * @param id 表格的DOM元素ID
 * @param fileName 导出的文件名
 * @param sheetName 工作表名称
 */
export function exportTableToExcel(
  id: string,
  fileName: string = 'excel-export',
  sheetName: string = 'Sheet1',
) {
  // 获取表格元素
  const table = document.querySelector(`#${id}`);
  if (!table) {
    console.error(`表格元素 #${id} 不存在`);
    return;
  }
  // 创建工作簿
  const wb: WorkBook = XLSX.utils.book_new();
  // 将表格转换为工作表
  const ws: WorkSheet = XLSX.utils.table_to_sheet(table);
  // 将工作表添加到工作簿
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // 写入文件并下载
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function executeBill(data: any) {
  const exportData = [
    [
      '园区',
      '客户',
      '期初余额',
      '金额（人民币）',
      '',
      '合计',
      '备注',
      '收款状态',
    ],
    [
      '租金',
      '电费',
      '水费',
      '税金',
      '电梯费/卫生费',
      '管理费',
      '押金',
      '装修期水电费',
      '其他(杂费)',
    ],
  ];
  for (const item of data) {
    for (const bill of item.bills) {
      exportData.push([
        item.parkName,
        bill.tenantName,
        '',
        bill.factoryRent,
        bill.eleFee,
        bill.waterFee,
        bill.invoiceTax,
        '',
        '',
        '',
        '',
        '',
        '',
        bill.totalFee,
        bill.receiptTime,
        bill.receiveFee,
      ]);
    }
  }
  exportJsonToExcel(exportData);
}
