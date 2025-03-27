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

// 电费项目接口，继承基础账单项
export type ElectricityItem = BaseBillItem;

// 电费账单接口，使用泛型继承基础账单
export interface ElectricityBill
  extends Omit<BaseBill<ElectricityItem>, 'items'> {
  electricityItems: ElectricityItem[]; // 电费项目列表，保持原有字段名以兼容现有代码
}

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
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return createFormSchema('电费', '电表数', '度数', '度', '电费金额');
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
export function useColumns<T = ElectricityItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return createColumns(onActionClick);
}
