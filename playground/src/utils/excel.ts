import type * as ExcelJSTypes from 'exceljs';

import { retryImport } from '#/utils/retry-import';

type ExcelJSModule = typeof ExcelJSTypes;

let excelJSImportPromise: null | Promise<ExcelJSModule> = null;

function loadExcelJS() {
  excelJSImportPromise ??= retryImport(() => import('exceljs'));
  return excelJSImportPromise;
}

// 辅助函数：保存工作簿到文件
async function saveWorkbook(
  workbook: ExcelJSTypes.Workbook,
  fileName: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

// 应用表头格式：单元格合并和样式设置
function applyHeaderFormatting(
  worksheet: ExcelJSTypes.Worksheet,
  aoaData: any[][],
  dataMeta?: any[],
) {
  if (!aoaData?.length || !Array.isArray(aoaData[0])) return;

  const headerRow = aoaData[0];
  const colCount = headerRow.length;

  // 1. 合并单元格

  // 合并标题行：A1到N1合并为"各园区房租水电明细表"，O1到P1合并为年月
  worksheet.mergeCells(1, 1, 1, 14); // A1:N1
  worksheet.mergeCells(1, 15, 1, 16); // O1:P1

  // 合并D2到L2单元格 ('金额（人民币）')，如果表头行足够长
  if (colCount >= 12) {
    worksheet.mergeCells(2, 4, 2, 12);
  }

  // 垂直合并相同内容的单元格，排除已经水平合并的区域
  if (
    aoaData.length > 2 &&
    Array.isArray(aoaData[1]) &&
    Array.isArray(aoaData[2])
  ) {
    const subHeaderRow = aoaData[2];
    aoaData[1].forEach((headerText, colIndex) => {
      // 跳过已经水平合并的区域 (D2:L2，对应索引3-11)
      if (colIndex >= 3 && colIndex <= 11) return;

      // 如果表头和子表头内容相同，则垂直合并
      if (
        colIndex < subHeaderRow.length &&
        String(headerText) === String(subHeaderRow[colIndex])
      ) {
        worksheet.mergeCells(2, colIndex + 1, 3, colIndex + 1);
      }
    });
  }

  // 2. 应用样式

  // 定义边框样式
  const borderStyle: Partial<ExcelJSTypes.Border> = {
    color: { argb: 'FF000000' }, // 黑色
    style: 'thin',
  };

  // 为标题行和表头行应用样式
  for (let rowIndex = 1; rowIndex <= 3; rowIndex++) {
    for (let colIndex = 1; colIndex <= colCount; colIndex++) {
      const cell = worksheet.getCell(rowIndex, colIndex);

      // 设置垂直和水平居中
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true, // 允许文本换行
      };

      // 设置边框
      if (rowIndex !== 1) {
        cell.border = {
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
          top: borderStyle,
        };
      }

      // 为标题行设置样式
      if (rowIndex === 1) {
        // 使用三元表达式设置不同的字体大小
        cell.font = {
          name: '微软雅黑',
          size: colIndex <= 14 ? 14 : 9, // A到N列为14，O到P列为9
        };
      }
      // 为第三行的 D3 到 L3 单元格设置字体大小为 9
      else if (rowIndex === 3 && colIndex >= 4 && colIndex <= 12) {
        cell.font = {
          size: 9,
        };
      }
    }
  }

  // 3. 为数据行添加边框和应用园区单元格合并
  const totalRows = worksheet.rowCount;
  const totalCols = worksheet.columnCount;

  if (totalRows > 3) {
    // 如果有数据行
    for (let rowIndex = 4; rowIndex <= totalRows; rowIndex++) {
      for (let colIndex = 1; colIndex <= totalCols; colIndex++) {
        const cell = worksheet.getCell(rowIndex, colIndex);

        // 设置边框
        cell.border = {
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
          top: borderStyle,
        };

        // 从第四行开始，D列到P列（除去O列）的数据向右对齐
        if (colIndex >= 4 && colIndex <= 16 && colIndex !== 15) {
          cell.alignment = {
            horizontal: 'right',
            vertical: 'middle',
            wrapText: true,
          };
        }

        // 为合计行设置样式
        if (dataMeta && dataMeta.some((meta) => meta.totalRow === rowIndex)) {
          // 设置合计行的背景色为浅灰色
          cell.fill = {
            fgColor: { argb: 'FFF0F0F0' }, // 浅灰色
            pattern: 'solid',
            type: 'pattern',
          };
        }
      }
    }

    // 4. 合并每个园区的A列单元格
    if (dataMeta) {
      dataMeta.forEach((meta) => {
        if (meta.startRow && meta.endRow && meta.startRow <= meta.endRow) {
          // 合并该园区的A列单元格
          worksheet.mergeCells(meta.startRow, 1, meta.endRow, 1);

          // 设置垂直居中
          const mergedCell = worksheet.getCell(meta.startRow, 1);
          mergedCell.alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
        }
      });
    }
  }
}

/**
 * 将二维数组数据导出为Excel文件
 * @param data 二维数组数据
 * @param fileName 导出的文件名
 * @param sheetName 工作表名称
 */
export async function exportArrayToExcel(
  data: any[][],
  fileName: string = 'excel-export',
  sheetName: string = 'Sheet1',
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRows(data);
  await saveWorkbook(workbook, fileName);
}

/**
 * 将JSON数据导出为Excel文件
 * @param data 要导出的数据 (可以是对象数组 T[], 或数组的数组 any[][])
 * @param dataMeta 数据元信息，用于单元格合并等操作
 * @param fileName 导出的文件名
 * @param sheetName 工作表名称
 */
export async function exportJsonToExcel<T = any>(
  data: T[],
  dataMeta?: any[],
  fileName: string = 'excel-export',
  sheetName: string = 'Sheet1',
): Promise<void> {
  if (!data?.length) {
    // 如果数据为空，创建一个空的工作簿并保存
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet(sheetName);
    await saveWorkbook(workbook, fileName);
    return;
  }

  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  let dataForHeaderMerges: any[][] | undefined;

  // 检查 data 是否为数组的数组
  if (Array.isArray(data[0])) {
    const aoaData = data as any[][];
    dataForHeaderMerges = aoaData;
    const headerRow = aoaData[0];

    if (Array.isArray(headerRow)) {
      // 设置列定义
      worksheet.columns = headerRow.map((header, index) => ({
        header: String(header),
        key: `col${index}`,
      }));

      // 添加数据行（如果有）
      if (aoaData.length > 1) {
        // 将数据行转换为对象格式并添加到工作表
        const dataRows = aoaData.slice(1).map((rowArray) => {
          const rowObject: Record<string, any> = {};
          headerRow.forEach((_, colIdx) => {
            rowObject[`col${colIdx}`] = rowArray[colIdx];
          });
          return rowObject;
        });
        worksheet.addRows(dataRows);
      }
    } else {
      // 如果第一行不是数组，则作为普通二维数组处理
      worksheet.addRows(aoaData);
    }
  }
  // 检查 data 是否为对象数组
  else if (typeof data[0] === 'object' && data[0] !== null) {
    const arrayOfObjects = data as Record<string, any>[];
    // 确保第一个对象存在且有键
    const firstObject = arrayOfObjects[0] || {};
    const firstObjectKeys = Object.keys(firstObject);

    // 设置列定义
    worksheet.columns = firstObjectKeys.map((key) => ({
      header: key,
      key,
    }));

    // 添加数据行
    worksheet.addRows(arrayOfObjects);
  }
  // 其他类型数据
  else {
    // 将简单类型转换为行数组
    const simpleRows = data.map((item) =>
      Array.isArray(item) ? item : [item],
    );
    worksheet.addRows(simpleRows as any[][]);
  }

  // 应用样式修改
  if (dataForHeaderMerges) {
    applyHeaderFormatting(worksheet, dataForHeaderMerges, dataMeta);
  }

  // 在此处可以添加其他样式修改函数调用

  await saveWorkbook(workbook, fileName);
}

export async function executeBill(data: any): Promise<void> {
  // 获取当前日期，用于标题中的年月显示
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JavaScript 月份从 0 开始
  const yearMonthText = `${year}年${month}月份`;

  // 创建表头（添加标题行）
  const exportData = [
    [
      '各园区房租水电明细表',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      yearMonthText,
      '', // O-P列显示年月
    ],
    [
      '园区',
      '客户',
      '期初余额',
      '金额（人民币）',
      '金额（人民币）',
      '金额（人民币）',
      '金额（人民币）',
      '金额（人民币）',
      '金额（人民币）',
      '金额（人民币）',
      '金额（人民币）',
      '金额（人民币）',
      '',
      '合计',
      '备注',
      '收款状态',
    ],
    [
      '园区',
      '客户',
      '期初余额',
      '租金',
      '电费',
      '水费',
      '税金',
      '电梯费/\n卫生费',
      '管理费',
      '押金',
      '装修期\n水电费',
      '其他(杂费)',
      '',
      '合计',
      '备注',
      '收款状态',
    ],
  ];

  // 添加数据行
  const dataMeta = [];
  let currentRow = 4; // 从第4行开始（前三行是标题和表头）

  for (const item of data) {
    const startRow = currentRow; // 记录当前园区数据的起始行
    // 添加该园区的所有账单数据
    for (const bill of item.bills) {
      // 计算总费用并四舍五入到整数
      const totalFee = Math.round(
        Number(bill.factoryRent) +
          Number(bill.eleFee) +
          Number(bill.waterFee) +
          Number(bill.invoiceTax),
      );
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
        totalFee, // 转换为字符串
        bill.receiptTime,
        bill.receiveFee,
      ]);
      currentRow++;
    }

    // 添加该园区的合计行
    const totalRow = [
      '合计', // A列显示"合计"
      '', // B列空白
      '0', // C列空白，改为空字符串
      // 计算该园区所有账单的各项费用合计，并四舍五入，转换为字符串
      String(
        Math.round(
          item.bills.reduce(
            (sum: number, bill: any) => sum + (Number(bill.factoryRent) || 0),
            0,
          ),
        ),
      ),
      String(
        Math.round(
          item.bills.reduce(
            (sum: number, bill: any) => sum + (Number(bill.eleFee) || 0),
            0,
          ),
        ),
      ),
      String(
        Math.round(
          item.bills.reduce(
            (sum: number, bill: any) => sum + (Number(bill.waterFee) || 0),
            0,
          ),
        ),
      ),
      String(
        Math.round(
          item.bills.reduce(
            (sum: number, bill: any) => sum + (Number(bill.invoiceTax) || 0),
            0,
          ),
        ),
      ),
      '',
      '',
      '',
      '',
      '',
      '', // M列空白
      // 计算该园区所有账单的总金额合计，并四舍五入，转换为字符串
      String(
        Math.round(
          item.bills.reduce(
            (sum: number, bill: any) => sum + (Number(bill.totalFee) || 0),
            0,
          ),
        ),
      ),
      '', // O列空白
      '', // P列空白
    ];

    exportData.push(totalRow);
    currentRow++;

    // 记录园区数据的元信息
    dataMeta.push({
      count: item.bills.length,
      endRow: currentRow - 2, // 减2是因为currentRow已经包含了合计行和下一个园区的起始位置
      parkName: item.parkName,
      startRow,
      totalRow: currentRow - 1, // 合计行的行号
    });
  }

  // 将数据和元信息一起传递给导出函数
  await exportJsonToExcel(exportData, dataMeta);
}
