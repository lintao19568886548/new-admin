import type { Dayjs } from 'dayjs';

import type { Ref } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';

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
  paymentTime: Ref<Dayjs>; // 收款时间
  projectName: string; // 项目名称
}

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
export function useColumns<T = ElectricityItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'companyName',
      minWidth: 160,
      title: '公司名称',
    },
    {
      field: 'projectName',
      minWidth: 160,
      title: '项目名称',
    },
    {
      field: 'paymentTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      title: '收款时间',
      width: 120,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'companyName',
          nameTitle: '电费账单',
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
