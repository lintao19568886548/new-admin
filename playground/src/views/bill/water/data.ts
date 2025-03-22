import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';

// 水费账单数据接口
export interface WaterItem {
  actualUsage: number; // 本月实际用水量
  amount: number; // 水费金额（元）
  companyName: string; // 公司名称
  currentMonthReading: number; // 本月水表数
  id: number;
  lastMonthReading: number; // 上月水表数
  monthlyUsage: number; // 本月用水量
  multiplier: number; // 倍数
  name: string; // 名称
  paymentTime: string; // 收款时间
  projectName: string; // 项目名称
  remark: string; // 备注
  unitPrice: number; // 单价元/吨
}

export interface WaterListParams {
  companyName?: string;
  paymentTime?: [string, string];
  projectName?: string;
}

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'companyName',
      label: '公司名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'Input',
      fieldName: 'projectName',
      label: '项目名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
      },
      fieldName: 'paymentTime',
      label: '收款时间',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: '名称',
      rules: z.string().min(2).max(50),
    },
    {
      component: 'InputNumber',
      componentProps: {
        precision: 2,
      },
      fieldName: 'lastMonthReading',
      label: '上月水表数',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        precision: 2,
      },
      fieldName: 'currentMonthReading',
      label: '本月水表数',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        precision: 2,
      },
      defaultValue: 1,
      fieldName: 'multiplier',
      label: '倍数',
      rules: z.number().min(0),
    },
    {
      component: 'InputNumber',
      componentProps: {
        precision: 2,
      },
      fieldName: 'unitPrice',
      label: '单价(元/吨)',
      rules: z.number().min(0),
    },
    {
      component: 'Textarea',
      componentProps: {
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
