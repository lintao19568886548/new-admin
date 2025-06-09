import type { BillDetailConfig } from './modules/BillBaseConfig';
import type { BillFormConfig } from './modules/BillForm.vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

/**
 * 总账单接口
 */
export interface AmountBill {
  billId?: number; // 账单ID
  createTime?: Date | string; // 创建时间
  eleBills?: any[]; // 电费账单项（详情用）
  eleFee: number; // 电费合计
  eleTax?: number; // 电费税金
  eleTaxRate?: number; // 电费税金
  extraEleItem?: string[]; // 额外服务费项;
  extraEleRate?: number; // 额外服务费比率;
  factoryRent: number; // 厂房租金
  garbageFee: number; // 垃圾管理费
  invoiceTax: number; // 开票税金
  managementFee: number; // 基本管理费
  parkId?: number; // 园区ID
  penalty?: number[]; // 滞纳金数据
  penaltyFee?: number; // 滞纳金
  penaltyRate?: number;
  privateBankAccount?: string; // 对私银行账户
  projectName?: string; // 项目名称
  publicBankAccount?: string; // 对公银行账户
  receiptTime?: string; // 收款时间
  remark?: string; // 备注
  rentTax?: number; // 租金税金
  rentTaxRate?: number; // 租金税金
  serviceFee: number; // 服务费
  serviceRate?: number; // 服务费比率
  taxRate?: string; // 开票税金
  tenant?: any; // 租户信息
  tenantId?: number; // 租户ID
  tenantName?: string; // 租户名称
  totalFee: number; // 总费用
  waterBills?: any[]; // 水费账单项（详情用）
  waterFee: number; // 水费合计
  waterTax?: number; // 水费税金
  waterTaxRate?: number; // 水费税金
}

/**
 * 总账单详情配置
 */
export const summaryDetailConfig: BillDetailConfig = {
  amountLabel: '金额',
  defaultItemName: '电费',
  defaultSubItemName: '水费',
  modalClass: 'summary-bill-detail-modal max-w-[90%] w-auto',
  modalTitle: '账单详情',
  readingLabel: '读数',
  unitLabel: '单位',
  usageLabel: '用量',
  itemsField: 'items',
};

/**
 * 总账单表单配置
 */
export const summaryFormConfig: BillFormConfig = {
  amountLabel: '金额',
  modalClass: 'summary-bill-form-modal max-w-[90%] w-auto',
  modalTitle: '账单表单',
  readingLabel: '读数',
  unitLabel: '单位',
  usageLabel: '用量',
  itemsField: 'otherItems',
};

/**
 * 电费账单表单配置
 */
export const electricityFormConfig: BillFormConfig = {
  amountLabel: '电费金额',
  modalClass: 'electricity-bill-form-modal max-w-[90%] w-auto',
  modalTitle: '电费账单表单',
  readingLabel: '电表数',
  unitLabel: '度',
  usageLabel: '度数',
  itemsField: 'ele',
};

/**
 * 水费账单表单配置
 */
export const waterFormConfig: BillFormConfig = {
  amountLabel: '水费金额',
  modalClass: 'water-bill-form-modal max-w-[90%] w-auto',
  modalTitle: '水费账单表单',
  readingLabel: '水表数',
  unitLabel: '㎡',
  usageLabel: '用量',
  itemsField: 'water',
};

/**
 * 获取表格查询表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'projectName',
      label: '项目名称',
    },
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: '租户名称',
    },

    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD', // 指定输出格式包含时分秒
      },
      fieldName: 'receiptTime',
      label: '收款时间',
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = AmountBill>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'projectName',
      minWidth: 150,
      title: '项目',
    },
    {
      field: 'tenantName',
      minWidth: 150,
      title: '租户名称',
    },
    {
      field: 'eleFee',
      formatter: ({ cellValue }) => {
        return cellValue ? `${Number(cellValue).toFixed(2)} 元` : '0.00 元';
      },
      minWidth: 120,
      title: '电费合计',
    },
    {
      field: 'waterFee',
      formatter: ({ cellValue }) => {
        return cellValue ? `${Number(cellValue).toFixed(2)} 元` : '0.00 元';
      },
      minWidth: 120,
      title: '水费合计',
    },
    {
      field: 'factoryRent',
      formatter: ({ cellValue }) => {
        return cellValue ? `${Number(cellValue).toFixed(2)} 元` : '0.00 元';
      },
      minWidth: 120,
      title: '厂房租金',
    },
    // {
    //   field: 'managementFee',
    //   formatter: ({ cellValue }) => {
    //     return cellValue ? `${Number(cellValue).toFixed(2)} 元` : '0.00 元';
    //   },
    //   minWidth: 120,
    //   title: '基本管理费',
    // },
    // {
    //   field: 'serviceFee',
    //   formatter: ({ cellValue }) => {
    //     return cellValue ? `${Number(cellValue).toFixed(2)} 元` : '0.00 元';
    //   },
    //   minWidth: 120,
    //   title: '服务费',
    // },
    // {
    //   field: 'invoiceTax',
    //   formatter: ({ cellValue }) => {
    //     return cellValue ? `${Number(cellValue).toFixed(2)} 元` : '0.00 元';
    //   },
    //   minWidth: 120,
    //   title: '开票税金',
    // },
    {
      field: 'totalFee',
      formatter: ({ cellValue }) => {
        return cellValue ? `${Number(cellValue).toFixed(2)} 元` : '0.00 元';
      },
      minWidth: 140,
      title: '本月收费金额',
    },
    {
      field: 'receiptTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 150,
      title: '收款时间',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'tenantName',
          nameTitle: '账单',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'next',
            text: '新增下月',
          },
          'edit',
          {
            code: 'print',
            text: '打印',
          },
          'delete',
        ],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 200,
      title: '操作',
    },
  ];
}
