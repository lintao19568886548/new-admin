import type { Dayjs } from 'dayjs';

import type { Ref } from 'vue';

import type { BillDetailConfig } from '../modules/BillDetail.vue';
import type { BillFormConfig } from '../modules/BillForm.vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';

// 修改为水费数据接口
export interface WaterItem {
  actualUsage: number; // 本月实际用水量
  amount: number; // 水费金额（元）
  currentMonthReading: number; // 本月水表数
  id: number;
  key: string;
  lastMonthReading: number; // 上月水表数
  monthlyUsage: number; // 本月用水量
  multiplier: number; // 倍数
  name: string; // 名称
  remark: string; // 备注
  unitPrice: number; // 单价元/吨
}

export interface WaterBill {
  companyName: string; // 公司名称
  id: number;
  paymentTime: Ref<Dayjs>; // 收款时间
  position: string; // 位置
  projectName: string; // 项目名称
  waterItems: WaterItem[]; // 水费项目列表
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
        placeholder: '例如：5月水费',
      },
      fieldName: 'name',
      label: '名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: '请输入上月水表数',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'lastMonthReading',
      label: '上月水表数',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        min: 0,
        placeholder: '请输入本月水表数',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'currentMonthReading',
      label: '本月水表数',
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
      label: '本月用水量',
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
      label: '本月实际用水量',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '元/吨',
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
      label: '水费金额',
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
export function useColumns<T = WaterItem>(
  onActionClick: OnActionClickFn<T>,
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
      cellRender: {
        attrs: {
          nameField: 'companyName',
          nameTitle: '水费账单',
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
