<script lang="ts" setup>
import type { AmountBill } from '../data';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import {
  BorderStyleTypes,
  BorderType,
  createUniver,
  defaultTheme,
  FUniver,
  LocaleType,
  merge,
  Univer,
} from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core';
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN';
import { UniverSheetsDataValidationPreset } from '@univerjs/presets/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationZhCN from '@univerjs/presets/preset-sheets-data-validation/locales/zh-CN';
import { message } from 'ant-design-vue';

import { getParkList } from '#/api/park';
import { getTenantSelectList } from '#/api/rental/tenant';

const props = defineProps<{
  billData: AmountBill;
  parkOptions?: any[];
  tenantOptions?: any[];
}>();

let cachedTenantOptions: any[] | null = null;
let cachedParkOptions: any[] | null = null;
let tenantOptionsPromise: null | Promise<any[]> = null;
let parkOptionsPromise: null | Promise<any[]> = null;

function normalizeOptionList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function rememberTenantOptions(value: unknown) {
  const normalized = normalizeOptionList(value);
  if (normalized.length > 0) {
    cachedTenantOptions = normalized;
  }
  return normalized;
}

function rememberParkOptions(value: unknown) {
  const normalized = normalizeOptionList(value);
  if (normalized.length > 0) {
    cachedParkOptions = normalized;
  }
  return normalized;
}

async function loadTenantOptions(prefilled: any[] = []) {
  if (prefilled.length > 0) {
    return rememberTenantOptions(prefilled);
  }
  if (cachedTenantOptions) {
    return cachedTenantOptions;
  }
  if (!tenantOptionsPromise) {
    tenantOptionsPromise = getTenantSelectList()
      .then((result) => rememberTenantOptions(result))
      .finally(() => {
        tenantOptionsPromise = null;
      });
  }
  return tenantOptionsPromise;
}

async function loadParkOptions(prefilled: any[] = []) {
  if (prefilled.length > 0) {
    return rememberParkOptions(prefilled);
  }
  if (cachedParkOptions) {
    return cachedParkOptions;
  }
  if (!parkOptionsPromise) {
    parkOptionsPromise = getParkList()
      .then((result) => rememberParkOptions(result))
      .finally(() => {
        parkOptionsPromise = null;
      });
  }
  return parkOptionsPromise;
}

const univerContainer = ref<HTMLElement | null>(null);
let univerInstance: null | Univer = null;
let univerAPI: FUniver | null = null;
const tenantLookupOptions = ref<any[]>([]);
const parkLookupOptions = ref<any[]>([]);

function normalizeBankAccountText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/^'/, '');
}

function setTextFormat(worksheet: any, range: string) {
  try {
    worksheet.getRange(range).setNumberFormat('@');
  } catch (error) {
    console.warn('设置文本格式失败:', error);
  }
}

function setTextCellValue(worksheet: any, rangeText: string, value: unknown) {
  try {
    const range = worksheet.getRange(rangeText);
    range.setNumberFormat('@');
    range.setHorizontalAlignment('center');
    range.setVerticalAlignment('middle');
    range.setValue(normalizeBankAccountText(value));
  } catch (error) {
    console.warn('设置文本单元格失败:', error);
  }
}

async function init() {
  if (!univerContainer.value) {
    return;
  }
  // Dispose previous instance before creating a new one
  dispose();

  try {
    const referenceDataPromise = Promise.all([
      loadTenantOptions(props.tenantOptions || []),
      loadParkOptions(props.parkOptions || []),
    ]);

    const result = createUniver({
      locale: LocaleType.ZH_CN,
      locales: {
        [LocaleType.ZH_CN]: merge(
          {},
          UniverPresetSheetsCoreZhCN,
          UniverPresetSheetsDataValidationZhCN,
        ),
      },
      presets: [
        UniverSheetsCorePreset({
          container: univerContainer.value as HTMLElement,
        }),
        UniverSheetsDataValidationPreset(),
      ],
      theme: defaultTheme,
    });

    univerInstance = result.univer;
    univerAPI = result.univerAPI;

    [tenantLookupOptions.value, parkLookupOptions.value] =
      await referenceDataPromise;

    const workbook = univerAPI.createWorkbook({
      name: '水电费明细',
    });
    const worksheet = workbook.getActiveSheet();

    let rowIndex = 1;
    let parsedEleItems: Record<string, { originalText: string; value: any }>[] =
      [];
    let parsedWaterItems: Record<
      string,
      { originalText: string; value: any }
    >[] = [];

    worksheet.getRange(`A${rowIndex}`).setValue('收款通知单').setFontSize(16);
    rowIndex++;

    worksheet.getRange(`A${rowIndex}`).setValue('租户名称');
    worksheet
      .getRange(`A${rowIndex}:I${rowIndex}`)
      .setHorizontalAlignment('center');
    worksheet
      .getRange(`A${rowIndex}:I${rowIndex}`)
      .setVerticalAlignment('middle');

    if (tenantLookupOptions.value && Array.isArray(tenantLookupOptions.value)) {
      const tenantNames = tenantLookupOptions.value.map(
        (tenant: any) => tenant.tenantName || tenant.label || '',
      );

      if (tenantNames.length > 0) {
        const tenantRule = univerAPI
          .newDataValidation()
          .requireValueInList(tenantNames)
          .setOptions({
            renderMode: univerAPI.Enum.DataValidationRenderMode.TEXT,
          })
          .build();

        worksheet
          .getRange(`B${rowIndex}:D${rowIndex}`)
          .setDataValidation(tenantRule);

        if (props.billData.tenantName) {
          worksheet
            .getRange(`B${rowIndex}`)
            .setValue(props.billData.tenantName);
        }
      }
    }

    worksheet
      .getRange(`F${rowIndex}`)
      .setValue('园区')
      .setHorizontalAlignment('center');

    if (parkLookupOptions.value && Array.isArray(parkLookupOptions.value)) {
      const parkNames = parkLookupOptions.value.map(
        (park: any) => park.parkName || park.label || '',
      );

      if (parkNames.length > 0) {
        const parkRule = univerAPI
          .newDataValidation()
          .requireValueInList(parkNames)
          .setOptions({
            renderMode: univerAPI.Enum.DataValidationRenderMode.TEXT,
          })
          .build();

        worksheet
          .getRange(`G${rowIndex}:I${rowIndex}`)
          .setDataValidation(parkRule);

        if (props.billData.parkId) {
          worksheet
            .getRange(`G${rowIndex}`)
            .setValue(
              parkLookupOptions.value.find(
                (park) => park.parkId === props.billData.parkId,
              )?.parkName || '',
            );
        }
      }
    }

    rowIndex += 1;

    worksheet.getRange(`A${rowIndex}`).setValue('项目');
    worksheet
      .getRange(`B${rowIndex}`)
      .setValue(props.billData.projectName || '');
    worksheet
      .getRange(`A${rowIndex}:I${rowIndex}`)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    rowIndex++;

    const eleTitle = '电费（度）';
    const eleHeaders = [
      '名称',
      '上月电表数',
      '本月抄表数',
      '本月际度数',
      '倍数',
      '本月实际度数',
      '单价(元/度)',
      '电费金额(元)',
      '备注',
    ];
    const eleData =
      props.billData.eleBills?.filter((item) => item.meterName !== '合计') ||
      [];

    worksheet.getRange(`A${rowIndex}`).setValue(eleTitle);
    rowIndex++;

    worksheet.getRange(`A${rowIndex}:I${rowIndex}`).setValues([eleHeaders]);
    const eleHeaderRow = rowIndex;
    rowIndex++;

    const eleDataStartRow = rowIndex;
    if (eleData.length > 0) {
      if (props.billData.eleItem) {
        try {
          parsedEleItems = JSON.parse(props.billData.eleItem);
        } catch (error) {
          console.error('解析电费原始数据失败:', error);
        }
      }

      eleData.forEach((item, index) => {
        let rowValues = [
          item.meterName,
          item.previousReading,
          item.currentReading,
          '',
          item.multiplier,
          '',
          item.unitPrice,
          '',
          item.remark,
        ];

        if (parsedEleItems[index]) {
          const eleItem = parsedEleItems[index];
          rowValues = [
            eleItem.meterName?.originalText || item.meterName,
            eleItem.previousReading?.originalText || item.previousReading,
            eleItem.currentReading?.originalText || item.currentReading,
            '',
            eleItem.multiplier?.originalText || item.multiplier,
            '',
            eleItem.unitPrice?.originalText || item.unitPrice,
            '',
            eleItem.remark?.originalText || item.remark,
          ];
        }

        worksheet.getRange(`A${rowIndex}:I${rowIndex}`).setValues([rowValues]);
        rowIndex++;
      });
    } else {
      for (let i = 0; i < 3; i++) {
        worksheet
          .getRange(`A${rowIndex}:I${rowIndex}`)
          .setValues([['', '', '', '', '', '', '', '', '']]);
        rowIndex++;
      }
    }
    const eleDataEndRow = rowIndex - 1;

    worksheet.getRange(`A${rowIndex}`).setValue('合计');
    const eleTotalRow = rowIndex;
    rowIndex++;

    const waterTitle = '水费（方）';
    const waterHeaders = [
      '名称',
      '上月水表数',
      '本月抄表数',
      '本月用水量',
      '倍数',
      '总用量',
      '单价(元/m²)',
      '水费金额(元)',
      '备注',
    ];
    const waterData =
      props.billData.waterBills?.filter((item) => item.meterName !== '合计') ||
      [];

    worksheet.getRange(`A${rowIndex}`).setValue(waterTitle);
    rowIndex++;

    worksheet.getRange(`A${rowIndex}:I${rowIndex}`).setValues([waterHeaders]);
    const waterHeaderRow = rowIndex;
    rowIndex++;

    const waterDataStartRow = rowIndex;
    if (waterData.length > 0) {
      if (props.billData.waterItem) {
        try {
          parsedWaterItems = JSON.parse(props.billData.waterItem);
        } catch (error) {
          console.error('解析水费原始数据失败:', error);
        }
      }

      waterData.forEach((item, index) => {
        let rowValues = [
          item.meterName,
          item.previousReading,
          item.currentReading,
          '',
          item.multiplier,
          '',
          item.unitPrice,
          '',
          item.remark,
        ];

        if (parsedWaterItems[index]) {
          const waterItem = parsedWaterItems[index];
          rowValues = [
            waterItem.meterName?.originalText || item.meterName,
            waterItem.previousReading?.originalText || item.previousReading,
            waterItem.currentReading?.originalText || item.currentReading,
            '',
            waterItem.multiplier?.originalText || item.multiplier,
            '',
            waterItem.unitPrice?.originalText || item.unitPrice,
            '',
            waterItem.remark?.originalText || item.remark,
          ];
        }

        worksheet.getRange(`A${rowIndex}:I${rowIndex}`).setValues([rowValues]);
        rowIndex++;
      });
    } else {
      for (let i = 0; i < 3; i++) {
        worksheet
          .getRange(`A${rowIndex}:I${rowIndex}`)
          .setValues([['', '', '', '', '', '', '', '', '']]);
        rowIndex++;
      }
    }
    const waterDataEndRow = rowIndex - 1;

    worksheet.getRange(`A${rowIndex}`).setValue('合计');
    const waterTotalRow = rowIndex;
    rowIndex++;

    const feeTitle = '项目合计';
    worksheet.getRange(`A${rowIndex}`).setValue(feeTitle);
    const feeTitleRow = rowIndex;
    rowIndex++;

    const feeHeaderRow = rowIndex;

    const feeDataStartRow = rowIndex;
    const standardFeeData: (number | string)[][] = [
      ['电费', props.billData.eleFee || 0],
      ['水费', props.billData.waterFee || 0],
      ['厂房租金', props.billData.factoryRent || 0],
      ['基本管理费', props.billData.managementFee || 0],
      ['垃圾处理费', props.billData.garbageFee || 0],
      ['服务费', props.billData.serviceFee || 0],
      ['开票税金', props.billData.invoiceTax || 0],
      ['滞纳金', props.billData.penaltyFee || 0],
    ];
    let feeData: (number | string)[][] = [...standardFeeData];

    if (props.billData.extraProjectItem) {
      try {
        const parsedItems = JSON.parse(props.billData.extraProjectItem) as {
          itemName: string;
          originalText?: string;
          value: number;
        }[];
        const itemsToDisplay = parsedItems.filter(
          (p) => p.itemName !== '本月收费金额',
        );
        if (itemsToDisplay.length > 0) {
          itemsToDisplay.forEach((item) => {
            const valueToUse = item.originalText || item.value;
            const matchedIndex = feeData.findIndex(
              ([itemName]) => itemName === item.itemName,
            );

            if (matchedIndex !== -1) {
              feeData[matchedIndex] = [item.itemName, valueToUse];
              return;
            }

            feeData.push([item.itemName, valueToUse]);
          });
        }
      } catch (error) {
        console.error(
          'Failed to parse extraProjectItem, using default fee data.',
          error,
        );
        feeData = [...standardFeeData];
      }
    }

    if (feeData.length > 0) {
      worksheet
        .getRange(`A${rowIndex}:B${rowIndex + feeData.length - 1}`)
        .setValues(feeData);
    }
    rowIndex += feeData.length;

    worksheet.getRange(`A${rowIndex}`).setValue('本月收费金额');
    const feeTotalRow = rowIndex;
    const eleFeeRow = feeDataStartRow;
    const waterFeeRow = feeDataStartRow + 1;
    rowIndex++;
    rowIndex++; // Spacer row

    // --- Add Bank Account Table ---
    const bankTableStartRow = rowIndex;
    let publicAccountData = { bank: '', name: '', number: '' };
    if (props.billData.publicBankAccount) {
      try {
        const parsed = JSON.parse(props.billData.publicBankAccount);
        if (parsed) {
          publicAccountData = {
            bank: parsed.bank || '',
            name: parsed.name || '',
            number: normalizeBankAccountText(parsed.number),
          };
        }
      } catch (error) {
        console.error('Failed to parse publicBankAccount', error);
      }
    }

    let privateAccountData = { bank: '', name: '', number: '' };
    if (props.billData.privateBankAccount) {
      try {
        const parsed = JSON.parse(props.billData.privateBankAccount);
        if (parsed) {
          privateAccountData = {
            bank: parsed.bank || '',
            name: parsed.name || '',
            number: normalizeBankAccountText(parsed.number),
          };
        }
      } catch (error) {
        console.error('Failed to parse privateBankAccount', error);
      }
    }

    worksheet
      .getRange(`A${rowIndex}:I${rowIndex}`)
      .setValues([
        ['银行账户', '户名', '', '账号', '', '', '开户行', '', '', '', ''],
      ]);
    rowIndex++;
    worksheet
      .getRange(`A${rowIndex}:I${rowIndex}`)
      .setValues([
        [
          '对公账户',
          publicAccountData.name,
          '',
          '',
          '',
          '',
          publicAccountData.bank,
          '',
          '',
          '',
          '',
        ],
      ]);
    rowIndex++;
    worksheet
      .getRange(`A${rowIndex}:I${rowIndex}`)
      .setValues([
        [
          '对私账户',
          privateAccountData.name,
          '',
          '',
          '',
          '',
          privateAccountData.bank,
          '',
          '',
          '',
          '',
        ],
      ]);
    const bankTableEndRow = rowIndex;
    rowIndex++;
    // --- End of Bank Account Table ---

    worksheet
      .getRange('J2')
      .setValue('收款时间')
      .setHorizontalAlignment('center');
    if (props.billData.receiptTime) {
      try {
        const date = new Date(props.billData.receiptTime);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        worksheet.getRange('K2').setValue(`${year}-${month}-${day}`);
      } catch {
        worksheet.getRange('K2').setValue(props.billData.receiptTime);
      }
    }

    worksheet
      .getRange('J3')
      .setValue('收款金额')
      .setHorizontalAlignment('center');
    worksheet.getRange('K3').setValue(props.billData.receiptAmount || 0);
    worksheet.getRange('K2:K3').setHorizontalAlignment('center');

    rowIndex += 1;

    const colWidths = [150, 100, 100, 100, 70, 120, 120, 120, 100, 100, 120];
    colWidths.forEach((width, index) => {
      worksheet.setColumnWidth(index, width);
    });

    [1, 4, waterHeaderRow - 1, feeTitleRow].forEach((r) => {
      const range = worksheet.getRange(r === 1 ? `A${r}:K${r}` : `A${r}:I${r}`);
      if (r === 1) range.setFontSize(14);
      range
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setFontFamily('Microsoft YaHei');
    });

    [eleHeaderRow, waterHeaderRow].forEach((r) => {
      const range = worksheet.getRange(`A${r}:I${r}`);
      range.setHorizontalAlignment('center');
      range.setVerticalAlignment('middle');
    });

    const fullRange = worksheet.getRange(`A${eleDataStartRow}:I${rowIndex}`);
    fullRange.setHorizontalAlignment('center');
    fullRange.setVerticalAlignment('middle');

    worksheet
      .getRange(`A2:K3`)
      .setBorder(BorderType.ALL, BorderStyleTypes.THIN);
    worksheet
      .getRange(`A${eleHeaderRow}:I${eleTotalRow}`)
      .setBorder(BorderType.ALL, BorderStyleTypes.THIN);
    worksheet
      .getRange(`A${waterHeaderRow}:I${waterTotalRow}`)
      .setBorder(BorderType.ALL, BorderStyleTypes.THIN);
    worksheet
      .getRange(`A${feeHeaderRow}:B${feeTotalRow}`)
      .setBorder(BorderType.ALL, BorderStyleTypes.THIN);

    setTimeout(() => {
      if (!univerAPI) return;
      const workbook = univerAPI.getActiveWorkbook();
      const worksheet = workbook?.getActiveSheet();
      if (!worksheet) return;

      if (eleDataEndRow >= eleDataStartRow) {
        for (let i = eleDataStartRow; i <= eleDataEndRow; i++) {
          const parsedItem = parsedEleItems[i - eleDataStartRow];
          // Sanitize all relevant numeric inputs, defaulting to 0 if invalid

          // Validate and set Monthly Usage (Column D)
          if (
            parsedItem &&
            parsedItem.monthlyUsage &&
            parsedItem.monthlyUsage.originalText !== null
          ) {
            worksheet
              .getRange(`D${i}`)
              .setValue(parsedItem.monthlyUsage.originalText);
          } else {
            worksheet.getRange(`D${i}`).setFormula(`=C${i}-B${i}`);
          }

          // Validate and set Total Usage (Column F)
          if (
            parsedItem &&
            parsedItem.totalUsage &&
            parsedItem.totalUsage.originalText !== null
          ) {
            worksheet
              .getRange(`F${i}`)
              .setValue(parsedItem.totalUsage.originalText);
          } else {
            worksheet.getRange(`F${i}`).setFormula(`=D${i}*E${i}`);
          }

          // Validate and set Amount (Column H)
          if (
            parsedItem &&
            parsedItem.amount &&
            parsedItem.amount.originalText !== null
          ) {
            worksheet
              .getRange(`H${i}`)
              .setValue(parsedItem.amount.originalText);
          } else {
            worksheet.getRange(`H${i}`).setFormula(`=F${i}*G${i}`);
          }
        }
      }

      if (waterDataEndRow >= waterDataStartRow) {
        for (let i = waterDataStartRow; i <= waterDataEndRow; i++) {
          const parsedItem = parsedWaterItems[i - waterDataStartRow];
          // Sanitize all relevant numeric inputs, defaulting to 0 if invalid

          // Validate and set Monthly Usage (Column D)
          if (
            parsedItem &&
            parsedItem.monthlyUsage &&
            parsedItem.monthlyUsage.originalText !== null
          ) {
            worksheet
              .getRange(`D${i}`)
              .setValue(parsedItem.monthlyUsage.originalText);
          } else {
            worksheet.getRange(`D${i}`).setFormula(`=C${i}-B${i}`);
          }

          // Validate and set Total Usage (Column F)
          if (
            parsedItem &&
            parsedItem.totalUsage &&
            parsedItem.totalUsage.originalText !== null
          ) {
            worksheet
              .getRange(`F${i}`)
              .setValue(parsedItem.totalUsage.originalText);
          } else {
            worksheet.getRange(`F${i}`).setFormula(`=D${i}*E${i}`);
          }

          // Validate and set Amount (Column H)
          if (
            parsedItem &&
            parsedItem.amount &&
            parsedItem.amount.originalText !== null
          ) {
            worksheet
              .getRange(`H${i}`)
              .setValue(parsedItem.amount.originalText);
          } else {
            worksheet.getRange(`H${i}`).setFormula(`=F${i}*G${i}`);
          }
        }
      }

      if (eleDataEndRow >= eleDataStartRow) {
        worksheet
          .getRange(`F${eleTotalRow}`)
          .setFormula(`=SUM(F${eleDataStartRow}:F${eleDataEndRow})`);
        worksheet
          .getRange(`H${eleTotalRow}`)
          .setFormula(`=SUM(H${eleDataStartRow}:H${eleDataEndRow})`);
        worksheet.getRange(`B${eleFeeRow}`).setFormula(`=H${eleTotalRow}`);
      } else {
        worksheet.getRange(`F${eleTotalRow}`).setValue(0);
        worksheet
          .getRange(`H${eleTotalRow}`)
          .setValue(props.billData.eleFee || 0);
        worksheet
          .getRange(`B${eleFeeRow}`)
          .setValue(props.billData.eleFee || 0);
      }

      if (waterDataEndRow >= waterDataStartRow) {
        worksheet
          .getRange(`F${waterTotalRow}`)
          .setFormula(`=SUM(F${waterDataStartRow}:F${waterDataEndRow})`);
        worksheet
          .getRange(`H${waterTotalRow}`)
          .setFormula(`=SUM(H${waterDataStartRow}:H${waterDataEndRow})`);
        worksheet.getRange(`B${waterFeeRow}`).setFormula(`=H${waterTotalRow}`);
      } else {
        worksheet.getRange(`F${waterTotalRow}`).setValue(0);
        worksheet
          .getRange(`H${waterTotalRow}`)
          .setValue(props.billData.waterFee || 0);
        worksheet
          .getRange(`B${waterFeeRow}`)
          .setValue(props.billData.waterFee || 0);
      }

      worksheet
        .getRange(`B${feeTotalRow}`)
        .setFormula(`=SUM(B${feeDataStartRow}:B${feeTotalRow - 1})`);

      setNumberFormat(
        worksheet,
        `B${eleDataStartRow}:D${eleTotalRow}`,
        '###0.00',
      );
      setNumberFormat(
        worksheet,
        `F${eleDataStartRow}:F${eleTotalRow}`,
        '###0.00',
      );
      setNumberFormat(
        worksheet,
        `H${eleDataStartRow}:H${eleTotalRow}`,
        '###0.00',
      );
      setNumberFormat(
        worksheet,
        `B${waterDataStartRow}:D${waterTotalRow}`,
        '###0.00',
      );
      setNumberFormat(
        worksheet,
        `F${waterDataStartRow}:F${waterTotalRow}`,
        '###0.00',
      );
      setNumberFormat(
        worksheet,
        `H${waterDataStartRow}:H${waterTotalRow}`,
        '###0.00',
      );
      setNumberFormat(
        worksheet,
        `B${feeDataStartRow}:B${feeTotalRow}`,
        '###0.00',
      );
      setNumberFormat(worksheet, `K3`, '###0.00');

      worksheet.getRange(`A1:K1`).merge();
      worksheet.getRange(`B2:E2`).merge();
      worksheet.getRange(`G2:I2`).merge();
      worksheet.getRange(`B3:H3`).merge();

      // Merges for bank table
      const bankHeaderRow = bankTableStartRow;
      const publicDataRow = bankTableStartRow + 1;
      const privateDataRow = bankTableStartRow + 2;
      // Header merges
      worksheet.getRange(`B${bankHeaderRow}:C${bankHeaderRow}`).merge();
      worksheet.getRange(`D${bankHeaderRow}:F${bankHeaderRow}`).merge();
      worksheet.getRange(`G${bankHeaderRow}:I${bankHeaderRow}`).merge();

      // Public account data merges
      worksheet.getRange(`B${publicDataRow}:C${publicDataRow}`).merge();
      worksheet.getRange(`D${publicDataRow}:F${publicDataRow}`).merge();
      worksheet.getRange(`G${publicDataRow}:I${publicDataRow}`).merge();

      // Private account data merges
      worksheet.getRange(`B${privateDataRow}:C${privateDataRow}`).merge();
      worksheet.getRange(`D${privateDataRow}:F${privateDataRow}`).merge();
      worksheet.getRange(`G${privateDataRow}:I${privateDataRow}`).merge();

      const publicAccountNumberRange = `D${publicDataRow}:F${publicDataRow}`;
      const privateAccountNumberRange = `D${privateDataRow}:F${privateDataRow}`;

      setTextFormat(worksheet, publicAccountNumberRange);
      setTextFormat(worksheet, privateAccountNumberRange);
      setTextCellValue(
        worksheet,
        publicAccountNumberRange,
        publicAccountData.number,
      );
      setTextCellValue(
        worksheet,
        privateAccountNumberRange,
        privateAccountData.number,
      );

      // Set border for the bank table after merging
      worksheet
        .getRange(`A${bankTableStartRow}:I${bankTableEndRow}`)
        .setBorder(BorderType.ALL, BorderStyleTypes.THIN);

      registerEvents();
    }, 500);
  } catch (error) {
    console.error('初始化水电费明细表格失败:', error);
    message.error('初始化水电费明细表格失败');
  }
}

/**
 * 安全地将值转换为数字。
 * 如果值是可解析的数字字符串，则转换为数字。
 * 如果值是数字，则直接返回。
 * 如果是空字符串、null或undefined，则返回null。
 * @param value - 要转换的值
 * @returns number | null
 */
function safeConvertToNumber(value: any): null | number {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function dispose() {
  if (univerInstance) {
    univerInstance.dispose();
    univerInstance = null;
    univerAPI = null;
  }
}

function getData() {
  if (!univerAPI) {
    return null;
  }
  const workbook = univerAPI.getActiveWorkbook();
  const worksheet = workbook?.getActiveSheet();
  if (!worksheet) {
    return null;
  }
  const lastRow = worksheet.getLastRow();
  const fullData = worksheet.getRange(`A1:K${lastRow + 1}`).getValues();
  const fullFormulas = worksheet.getRange(`A1:K${lastRow + 1}`).getFormulas();

  const eleBills: any[] = [];
  const waterBills: any[] = [];
  let isEleSection = false;
  let isWaterSection = false;
  const eleHeaders = [
    'meterName',
    'previousReading',
    'currentReading',
    'monthlyUsage',
    'multiplier',
    'totalUsage',
    'unitPrice',
    'amount',
    'remark',
  ];
  const waterHeaders = [
    'meterName',
    'previousReading',
    'currentReading',
    'monthlyUsage',
    'multiplier',
    'totalUsage',
    'unitPrice',
    'amount',
    'remark',
  ];

  const eleItemData: Record<string, any>[] = [];
  const waterItemData: Record<string, any>[] = [];

  for (const [rowIndex, row] of fullData.entries()) {
    const rowData: Record<string, any> = {};
    const formulaRow = fullFormulas[rowIndex] || [];

    if (row[0] === '电费（度）') {
      isEleSection = true;
      isWaterSection = false;
      continue;
    }
    if (row[0] === '水费（方）') {
      isEleSection = false;
      isWaterSection = true;
      continue;
    }

    if (isEleSection) {
      if (row[0] === '名称') continue;

      const eleItem: Record<string, { originalText: string; value: any }> = {};

      eleHeaders.forEach((header, index) => {
        const value = row[index];
        if (
          [
            'amount',
            'currentReading',
            'monthlyUsage',
            'multiplier',
            'previousReading',
            'totalUsage',
            'unitPrice',
          ].includes(header)
        ) {
          rowData[header] = safeConvertToNumber(value);
        } else {
          rowData[header] =
            header === 'meterName' ? String(value || '') : value;
        }

        const formula = formulaRow[index] || '';
        const originalText =
          formula ||
          (value !== null && value !== undefined ? String(value) : '');
        eleItem[header] = { originalText, value: rowData[header] };
      });

      eleItemData.push(eleItem);
      eleBills.push(rowData);
      if (row[0] === '合计') isEleSection = false;
    } else if (isWaterSection) {
      if (row[0] === '名称') continue;

      const waterItem: Record<string, { originalText: string; value: any }> =
        {};

      waterHeaders.forEach((header, index) => {
        const value = row[index];
        if (
          [
            'amount',
            'currentReading',
            'monthlyUsage',
            'multiplier',
            'previousReading',
            'totalUsage',
            'unitPrice',
          ].includes(header)
        ) {
          rowData[header] = safeConvertToNumber(value);
        } else {
          rowData[header] =
            header === 'meterName' ? String(value || '') : value;
        }
        const formula = formulaRow[index] || '';
        const originalText =
          formula ||
          (value !== null && value !== undefined ? String(value) : '');
        waterItem[header] = { originalText, value: rowData[header] };
      });

      waterItemData.push(waterItem);
      waterBills.push(rowData);
      if (row[0] === '合计') isWaterSection = false;
    }
  }

  const billData: Partial<AmountBill> = {};

  // --- 从表头提取数据 ---
  const tenantNameValue = worksheet.getRange('B2')?.getValue();
  const parkNameValue = worksheet.getRange('G2')?.getValue();
  const projectNameValue = worksheet.getRange('B3')?.getValue();

  const tenantName = String(tenantNameValue || '');
  const parkName = String(parkNameValue || '');

  billData.projectName = String(projectNameValue || '');
  billData.tenantName = tenantName;

  const tenant = tenantLookupOptions.value.find(
    (t) => t.tenantName === tenantName,
  );
  billData.tenantId = tenant?.tenantId || null;

  const park = parkLookupOptions.value.find((p) => p.parkName === parkName);
  if (park) {
    billData.parkId = park.parkId;
  }
  // --- 提取结束 ---

  billData.eleItem = JSON.stringify(eleItemData);
  billData.waterItem = JSON.stringify(waterItemData);

  billData.eleBills = eleBills;
  billData.waterBills = waterBills;

  const eleTotal = eleBills.find((item) => item.meterName === '合计');
  billData.eleFee = Number(eleTotal?.amount || 0);

  const waterTotal = waterBills.find((item) => item.meterName === '合计');
  const waterAmount = Number(waterTotal?.amount || 0);
  const waterUsage = Number(waterTotal?.totalUsage || 0);
  billData.garbageFee = waterUsage * (props.billData.garbageRate || 0);
  billData.waterFee = waterAmount;

  const eleFee = Number(billData.eleFee || 0);
  const serviceRate = Number(props.billData.serviceRate || 0);
  billData.serviceFee = eleFee * (serviceRate / 100);

  let extraProjectItem: string | undefined;
  try {
    const feeJson: {
      itemName: string;
      originalText: string;
      value: number;
    }[] = [];
    let feeSectionStarted = false;
    for (const [index, row] of fullData.entries()) {
      if (row[0] === '项目合计') {
        feeSectionStarted = true;
        continue;
      }

      if (feeSectionStarted) {
        const itemName = row[0];
        const value = row[1];
        const formula = fullFormulas[index]?.[1] || '';
        const originalText =
          formula ||
          (value !== null && value !== undefined ? String(value) : '');

        if (itemName && itemName !== '费用项') {
          feeJson.push({
            itemName: String(itemName),
            originalText,
            value: Number(value) || 0,
          });
          if (itemName.toString().includes('厂房租金')) {
            billData.factoryRent = Number(value) || 0;
            // eslint-disable-next-line unicorn/prefer-switch
          } else if (itemName === '垃圾处理费') {
            billData.garbageFee = Number(value) || 0;
          } else if (itemName === '基本管理费') {
            billData.managementFee = Number(value) || 0;
          } else if (itemName === '服务费') {
            billData.serviceFee = Number(value) || 0;
          } else if (itemName === '开票税金') {
            billData.invoiceTax = Number(value) || 0;
          } else if (itemName === '滞纳金') {
            billData.penaltyFee = Number(value) || 0;
          } else if (itemName === '本月收费金额') {
            billData.totalFee = Number(value) || 0;
            break;
          }
        }
      }
    }

    if (feeJson.length > 0) {
      extraProjectItem = JSON.stringify(feeJson);
    }
  } catch (error) {
    console.error('从费用合计表格提取数据时出错:', error);
    message.error('提取费用合计数据失败');
  }

  billData.extraProjectItem = extraProjectItem;

  // --- 提取收款时间和金额 ---
  const receiptTimeValue = worksheet.getRange('K2')?.getValue() as string;
  const date = receiptTimeValue ? new Date(receiptTimeValue) : null;
  billData.receiptTime =
    date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : receiptTimeValue || undefined;

  const receiptAmountValue = worksheet.getRange('K3')?.getValue();
  billData.receiptAmount = Number(receiptAmountValue) || 0;
  // --- 提取结束 ---

  // --- Extract Public/Private Account Info ---
  const publicAccount: {
    bank?: string;
    name?: string;
    number?: string;
  } = {};
  const privateAccount: {
    bank?: string;
    name?: string;
    number?: string;
  } = {};

  for (const row of fullData) {
    if (row[0] === '对公账户') {
      publicAccount.name = String(row[1] || '');
      publicAccount.number = normalizeBankAccountText(row[3]);
      publicAccount.bank = String(row[6] || '');
    } else if (row[0] === '对私账户') {
      privateAccount.name = String(row[1] || '');
      privateAccount.number = normalizeBankAccountText(row[3]);
      privateAccount.bank = String(row[6] || '');
    }
  }

  if (Object.values(publicAccount).some(Boolean)) {
    billData.publicBankAccount = JSON.stringify(publicAccount);
  }

  if (Object.values(privateAccount).some(Boolean)) {
    billData.privateBankAccount = JSON.stringify(privateAccount);
  }
  // --- End of Account Info ---

  return billData;
}

function setNumberFormat(
  worksheet: any,
  range: string,
  format: string = '#,##0.00',
) {
  try {
    worksheet.getRange(range).setNumberFormat(format);
  } catch (error) {
    console.warn('设置数字格式失败:', error);
  }
}

function registerEvents() {
  if (!univerAPI?.addEvent) {
    return;
  }
  univerAPI.addEvent(univerAPI.Event.SheetSkeletonChanged, (params: any) => {
    // 修改收款时间
    if (
      params?.payload?.id === 'sheet.mutation.set-worksheet-row-auto-height' &&
      params?.payload?.params?.rowsAutoHeightInfo?.[0]?.row === 1
    ) {
      const range = params.worksheet.getRange('K2');
      const currentValue = range.getRawValue();
      if (typeof currentValue === 'number') {
        const dateStr = String(currentValue);
        let formattedDate = '';

        switch (dateStr.length) {
          case 4: {
            // YYYY -> YYYY-01-01
            formattedDate = `${dateStr}-01-01`;
            break;
          }
          case 5: {
            // YYYYM -> YYYY-0M-01
            formattedDate = `${dateStr.slice(0, 4)}-${dateStr
              .slice(4, 5)
              .padStart(2, '0')}-01`;
            break;
          }
          case 6: {
            // YYYYMM -> YYYY-MM-01
            formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-01`;
            break;
          }
          case 8: {
            // YYYYMMDD -> YYYY-MM-DD
            formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(
              4,
              6,
            )}-${dateStr.slice(6, 8)}`;
            break;
          }
        }

        if (formattedDate) {
          range.setValue(formattedDate);
        }
      }
    }
    // 插入行事件
    if (params?.payload?.id === 'sheet.mutation.insert-row') {
      try {
        const worksheet = univerAPI?.getActiveWorkbook()?.getActiveSheet();
        if (!worksheet) return;

        const { endRow, startRow } = params.payload.params.range;

        let feeSectionStartRow = worksheet.getLastRow();
        const fullData = worksheet
          .getRange(`A1:A${feeSectionStartRow + 1}`)
          .getValues();
        for (const [i, fullDatum] of fullData.entries()) {
          if (fullDatum[0] === '项目合计') {
            feeSectionStartRow = i + 1;
            break;
          }
        }

        for (let i = startRow; i <= endRow; i++) {
          const rowIndex = i + 1;

          if (rowIndex < feeSectionStartRow) {
            const meterNameRange = worksheet.getRange(`A${rowIndex}`);
            const meterName = meterNameRange.getValue();

            if (
              meterName !== '合计' &&
              meterName !== '电费（度）' &&
              meterName !== '水费（方）'
            ) {
              setTimeout(() => {
                const currentSheet = univerAPI
                  ?.getActiveWorkbook()
                  ?.getActiveSheet();
                if (!currentSheet) return;
                currentSheet
                  .getRange(`D${rowIndex}`)
                  .setFormula(`=C${rowIndex}-B${rowIndex}`);
                currentSheet
                  .getRange(`F${rowIndex}`)
                  .setFormula(`=D${rowIndex}*E${rowIndex}`);
                currentSheet
                  .getRange(`H${rowIndex}`)
                  .setFormula(`=F${rowIndex}*G${rowIndex}`);

                setNumberFormat(currentSheet, `B${rowIndex}:D${rowIndex}`);
                setNumberFormat(currentSheet, `F${rowIndex}`);
                setNumberFormat(currentSheet, `H${rowIndex}`);
              }, 0);
            }
          }
        }
      } catch (error) {
        console.error('处理插入行事件时出错:', error);
      }
    }
  });
}

onMounted(async () => {
  await init();
});

onBeforeUnmount(() => {
  dispose();
});

defineExpose({
  dispose,
  getData,
});
</script>
<template>
  <div ref="univerContainer" style="width: 100%; height: 60vh"></div>
</template>

<style lang="less">
/* 全局样式，确保Univer元素显示在Modal之上 */
.univer-overlay,
.univer-popup,
.univer-dropdown,
.univer-menu,
.univer-contextmenu,
.univer-tooltip,
.univer-float-wrapper,
[class*='univer-'] {
  z-index: 2000 !important;
}

/* Univer容器样式 */
.univer-fee-container {
  position: relative;
  z-index: 1001;
}
</style>
