import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';

/**
 * 账单详情配置接口
 */
export interface BillDetailConfig {
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

// 基础账单项接口 - 根据 Prisma Schema 调整
export interface BaseBillItem {
  amount?: number; // 金额
  billId?: number; // 关联的账单ID
  createTime?: Date | string; // 创建时间
  currentReading?: number; // 本月读数
  meterName: string; // 表计名称
  monthlyUsage?: number; // 本月用量
  multiplier?: number; // 倍数
  previousReading?: number; // 上月读数
  receiptTime?: Date | string; // 收款时间
  remark?: string; // 备注
  totalUsage?: number; // 总用量
  unitPrice?: number; // 单价
}

// 基础账单接口 - 根据 Prisma Schema 调整
export interface BaseBill {
  billId: number; // 账单ID
  createTime?: Date | string; // 创建时间
  eleFee?: number; // 电费总额
  factoryRent?: number; // 厂房租金
  invoiceTax?: number; // 发票税费
  managementFee?: number; // 管理费
  receiptTime?: Date | string; // 收款时间
  serviceFee?: number; // 服务费
  tenantId: number; // 租户ID
  tenantName: string; // 租户名称
  totalFee?: number; // 总费用
  waterFee?: number; // 水费总额
}

// 电费账单项接口
export interface EleBillItem extends BaseBillItem {
  eleId: number; // 电费ID
}

// 水费账单项接口
export interface WaterBillItem extends BaseBillItem {
  waterId: number; // 水费ID
}

// 租户接口
export interface TenantInfo {
  tenantId: number; // 租户ID
  tenantName: string; // 租户名称
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
 * @param readingLabel 读数标签
 * @param usageLabel 用量标签
 * @param unitLabel 单位标签
 * @param amountLabel 金额标签
 */
export function createFormSchema(
  readingLabel: string,
  usageLabel: string,
  unitLabel: string,
  amountLabel: string,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入表计名称',
      },
      fieldName: 'meterName',
      label: '表计名称',
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
      fieldName: 'previousReading',
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
      fieldName: 'currentReading',
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
      fieldName: 'totalUsage',
      label: `总${usageLabel}`,
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
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择收款时间',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'receiptTime',
      label: '收款时间',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入备注信息',
        rows: 4,
      },
      fieldName: 'remarks',
      label: '备注',
    },
  ];
}

/**
 * 总账单表单配置
 */
export function createAmountBillFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入租户名称',
      },
      fieldName: 'tenantName',
      label: '租户名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'factoryRent',
      label: '厂房租金',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'managementFee',
      label: '管理费',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'serviceFee',
      label: '服务费',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元',
        min: 0,
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'invoiceTax',
      label: '发票税费',
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
      fieldName: 'totalFee',
      label: '总费用',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择收款时间',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'receiptTime',
      label: '收款时间',
      rules: 'required',
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
      fieldName: 'tenantName',
      label: '租户名称',
    },
    {
      component: 'RangePicker',
      fieldName: 'receiptTime',
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
      field: 'billId',
      minWidth: 80,
      title: '账单ID',
    },
    {
      field: 'tenantName',
      minWidth: 150,
      title: '租户名称',
    },
    {
      field: 'totalFee',
      minWidth: 120,
      title: '总费用(元)',
    },
    {
      field: 'receiptTime',
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
