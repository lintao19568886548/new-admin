import type { Dayjs } from 'dayjs';

import type { Ref } from 'vue';

import type { BillDetailConfig } from '../modules/BillDetail.vue';
import type { BillFormConfig } from '../modules/BillForm.vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';

/**
 * 总账单项目接口
 */
export interface BillSummaryItem {
  amount: number; // 金额（元）
  id: number;
  key: string;
  name: string; // 名称
  remark: string; // 备注
}

/**
 * 总账单接口
 */
export interface BillSummary {
  billMonth: string; // 账单月份，格式如：2023-05
  companyName: string; // 公司名称
  electricityBillId?: number; // 电费账单ID
  electricityItems?: any[]; // 电费项目（详情用）
  electricityTotal: number; // 电费合计
  factoryRent: number; // 厂房租金
  id: number;
  invoiceTax: number; // 开票税金
  managementFee: number; // 基本管理费
  otherItems?: BillSummaryItem[]; // 其他费用项目
  paymentTime: Ref<Dayjs>; // 收款时间
  projectName: string; // 项目名称
  serviceFee: number; // 服务费
  totalAmount: number; // 本月收费金额合计
  waterBillId?: number; // 水费账单ID
  waterItems?: any[]; // 水费项目（详情用）
  waterTotal: number; // 水费合计
}

// 修改为新的数据接口
export interface ElectricityItem {
  actualUsage: number; // 本月实际度数
  amount: number; // 电费金额（元）
  currentMonthReading: number; // 本月电表数
  id: number;
  key: string;
  lastMonthReading: number; // 上月电表数
  monthlyUsage: number; // 本月度数
  multiplier: number; // 倍数
  name: string; // 名称
  remark: string; // 备注
  unitPrice: number; // 单价元/度
}

export interface ElectricityBill {
  companyName: string; // 公司名称
  electricityItems: ElectricityItem[]; // 电费项目列表
  id: number;
  paymentTime: Ref<Dayjs>; // 收款时间
  position: string; // 位置
  projectName: string; // 项目名称
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
 * 电费账单详情配置
 */
export const electricityDetailConfig: BillDetailConfig = {
  amountLabel: '电费金额',
  defaultItemName: '主楼电费',
  defaultSubItemName: '附楼电费',
  modalClass: 'electricity-bill-detail-modal max-w-[90%] w-auto',
  modalTitle: '电费账单详情',
  readingLabel: '电表数',
  unitLabel: '度',
  usageLabel: '度数',
  itemsField: 'electricityItems',
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
  itemsField: 'electricityItems',
};

/**
 * 水费账单详情配置
 */
export const waterDetailConfig: BillDetailConfig = {
  amountLabel: '水费金额',
  defaultItemName: '主楼水费',
  defaultSubItemName: '附楼水费',
  modalClass: 'water-bill-detail-modal max-w-[90%] w-auto',
  modalTitle: '水费账单详情',
  readingLabel: '水表数',
  unitLabel: '吨',
  usageLabel: '用量',
  itemsField: 'waterItems',
};

/**
 * 水费账单表单配置
 */
export const waterFormConfig: BillFormConfig = {
  amountLabel: '水费金额',
  modalClass: 'water-bill-form-modal max-w-[90%] w-auto',
  modalTitle: '水费账单表单',
  readingLabel: '水表数',
  unitLabel: '吨',
  usageLabel: '用量',
  itemsField: 'waterItems',
};

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入公司名称',
      },
      fieldName: 'companyName',
      label: '公司名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入项目名称',
      },
      fieldName: 'projectName',
      label: '项目名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'DatePicker',
      fieldName: 'datePicker',
      label: '日期选择框',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '例如：5月电费',
      },
      fieldName: 'name',
      label: '名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: '请输入上月电表数',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'lastMonthReading',
      label: '上月电表数',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: '请输入本月电表数',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'currentMonthReading',
      label: '本月电表数',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        disabled: true,
        precision: 2,
        style: { background: '#f5f5f5', width: '100%' },
      },
      fieldName: 'monthlyUsage',
      label: '本月度数',
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      defaultValue: 1,
      fieldName: 'multiplier',
      label: '倍数',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        disabled: true,
        precision: 2,
        style: { background: '#f5f5f5', width: '100%' },
      },
      fieldName: 'actualUsage',
      label: '本月实际度数',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/度',
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'unitPrice',
      label: '单价',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        disabled: true,
        precision: 2,
        style: { background: '#f5f5f5', width: '100%' },
      },
      fieldName: 'amount',
      label: '电费金额',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入备注信息',
        rows: 4,
      },
      fieldName: 'remark',
      label: '备注',
    },
  ];
}

/**
 * 获取表格查询表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'companyName',
      label: '公司名称',
    },
    {
      component: 'Input',
      fieldName: 'projectName',
      label: '项目名称',
    },
    {
      component: 'RangePicker',
      fieldName: 'paymentTime',
      label: '收款时间',
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = BillSummary>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'billMonth',
      minWidth: 120,
      title: '账单月份',
    },
    {
      field: 'companyName',
      minWidth: 150,
      title: '公司名称',
    },
    {
      field: 'projectName',
      minWidth: 150,
      title: '项目名称',
    },
    {
      field: 'electricityTotal',
      formatter: ({ cellValue }) => {
        return `${cellValue.toFixed(2)} 元`;
      },
      minWidth: 120,
      title: '电费合计',
    },
    {
      field: 'waterTotal',
      formatter: ({ cellValue }) => {
        return `${cellValue.toFixed(2)} 元`;
      },
      minWidth: 120,
      title: '水费合计',
    },
    {
      field: 'factoryRent',
      formatter: ({ cellValue }) => {
        return `${cellValue.toFixed(2)} 元`;
      },
      minWidth: 120,
      title: '厂房租金',
    },
    {
      field: 'managementFee',
      formatter: ({ cellValue }) => {
        return `${cellValue.toFixed(2)} 元`;
      },
      minWidth: 120,
      title: '基本管理费',
    },
    {
      field: 'serviceFee',
      formatter: ({ cellValue }) => {
        return `${cellValue.toFixed(2)} 元`;
      },
      minWidth: 120,
      title: '服务费',
    },
    {
      field: 'invoiceTax',
      formatter: ({ cellValue }) => {
        return `${cellValue.toFixed(2)} 元`;
      },
      minWidth: 120,
      title: '开票税金',
    },
    {
      field: 'totalAmount',
      formatter: ({ cellValue }) => {
        return `${cellValue.toFixed(2)} 元`;
      },
      minWidth: 140,
      title: '本月收费金额合计',
    },
    {
      field: 'paymentTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      title: '收款时间',
      width: 150,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'companyName',
          nameTitle: '总账单',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'view',
            text: '查看',
          },
          'edit',
          'delete',
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: '操作',
      width: 150,
    },
  ];
}
