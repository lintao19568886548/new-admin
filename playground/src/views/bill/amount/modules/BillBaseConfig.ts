import type { Dayjs } from 'dayjs';

import type { Ref } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';

/**
 * 账单详情配置接口
 */
export interface BillDetailConfig {
  [key: string]: any; // 支持任意额外属性
  amountLabel?: string; // 金额标签（如"电费金额"或"水费金额"）
  defaultItemName?: string; // 默认项目名称（如"主楼电费"或"主楼水费"）
  defaultSubItemName?: string; // 默认子项目名称（如"附楼电费"或"附楼水费"）
  itemsField?: string; // 账单项目字段名（如"electricityItems"或"waterItems"）
  modalClass?: string; // 模态窗口CSS类名
  modalTitle?: string; // 模态窗口标题
  readingLabel?: string; // 读数标签（如"电表数"或"水表数"）
  unitLabel?: string; // 单位标签（如"度"或"吨"）
  usageLabel?: string; // 用量标签（如"度数"或"用水量"）
}

// 基础账单项接口
export interface BaseBillItem {
  actualUsage: number; // 实际用量
  amount: number; // 金额（元）
  currentMonthReading: number; // 本月表数
  id: number;
  key: string;
  lastMonthReading: number; // 上月表数
  monthlyUsage: number; // 本月用量
  multiplier: number; // 倍数
  name: string; // 名称
  remark: string; // 备注
  unitPrice: number; // 单价
}

// 基础账单接口
export interface BaseBill<T extends BaseBillItem> {
  companyName: string; // 公司名称
  id: number;
  items: T[]; // 账单项列表
  paymentTime: Ref<Dayjs>; // 收款时间
  position: string; // 位置
  projectName: string; // 项目名称
}

// 区域接口
export interface Area {
  key: string;
  name: string;
}

// 通用区域列表
export const commonAreaList = [
  { key: 'all', name: '全部区域' },
  { key: 'east', name: '东莞' },
  { key: 'central', name: '广州' },
  { key: 'south', name: '深圳' },
  { key: 'north', name: '佛山' },
  { key: 'west', name: '珠海' },
];

/**
 * 通用表单字段配置生成器
 * @param placeholderPrefix 占位符前缀
 * @param readingLabel 读数标签
 * @param usageLabel 用量标签
 * @param unitLabel 单位标签
 * @param amountLabel 金额标签
 */
export function createFormSchema(
  placeholderPrefix: string,
  readingLabel: string,
  usageLabel: string,
  unitLabel: string,
  amountLabel: string,
): VbenFormSchema[] {
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
        placeholder: `例如：5月${placeholderPrefix}`,
      },
      fieldName: 'name',
      label: '名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: `请输入上月${readingLabel}`,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'lastMonthReading',
      label: `上月${readingLabel}`,
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: `请输入本月${readingLabel}`,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'currentMonthReading',
      label: `本月${readingLabel}`,
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
      label: `本月${usageLabel}`,
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
      label: `本月实际${usageLabel}`,
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: `元/${unitLabel}`,
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
      label: amountLabel,
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
 * 通用表格查询表单配置
 */
export function createGridFormSchema(): VbenFormSchema[] {
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
 * 通用表格列配置生成器
 */
export function createColumns<T>(
  _onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
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
      field: 'position',
      minWidth: 100,
      title: '位置',
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
      field: 'operate',
      fixed: 'right',
      slots: {
        default: 'action',
      },
      title: '操作',
      width: 200,
    },
  ];
}
