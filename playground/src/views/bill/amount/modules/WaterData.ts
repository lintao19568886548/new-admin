import type { BillFormConfig } from '../BillForm.vue';
import type {
  BaseBill,
  BaseBillItem,
  BillDetailConfig,
} from './BillBaseConfig';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import {
  createColumns,
  createFormSchema,
  createGridFormSchema,
} from './BillBaseConfig';

// 水费项目接口，继承基础账单项
export type WaterItem = BaseBillItem;

// 水费账单接口，使用泛型继承基础账单
export interface WaterBill extends Omit<BaseBill<WaterItem>, 'items'> {
  waterItems: WaterItem[]; // 水费项目列表，保持原有字段名以兼容现有代码
}

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
  usageLabel: '用水量',
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
  usageLabel: '用水量',
  itemsField: 'waterItems',
};

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return createFormSchema('水费', '水表数', '用水量', '吨', '水费金额');
}

/**
 * 获取表格查询表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return createGridFormSchema();
}

/**
 * 获取表格列配置
 */
export function useColumns<T = WaterItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return createColumns(onActionClick);
}
