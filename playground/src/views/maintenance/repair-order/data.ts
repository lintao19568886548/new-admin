import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getFactoryListByParkId } from '#/api/factory';
import { getParkList } from '#/api/park';
import { $t } from '#/locales';

export const REPAIR_SOURCE_OPTIONS = [
  { label: '租户报修', value: '租户报修' },
  { label: '物业代报修', value: '物业代报修' },
];

export const REPAIR_TYPE_OPTIONS = [
  { label: '电路', value: '电路' },
  { label: '水暖', value: '水暖' },
  { label: '设备', value: '设备' },
  { label: '消防', value: '消防' },
  { label: '电梯', value: '电梯' },
  { label: '其他', value: '其他' },
];

export const REPAIR_STATUS_OPTIONS = [
  { label: '待接单', value: '待接单' },
  { label: '处理中', value: '处理中' },
  { label: '待验收', value: '待验收' },
  { label: '已完成', value: '已完成' },
  { label: '已取消', value: '已取消' },
];

export const REPAIR_PRIORITY_OPTIONS = [
  { label: '普通', value: '普通' },
  { label: '紧急', value: '紧急' },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: REPAIR_SOURCE_OPTIONS,
        optionType: 'button',
      },
      defaultValue: '物业代报修',
      fieldName: 'source',
      label: '来源',
      rules: 'required',
    },
    {
      component: 'ApiCascader',
      componentProps: {
        api: getFactoryListByParkId,
        changeOnSelect: false,
        expandTrigger: 'hover',
        placeholder: '请选择园区和厂房',
        style: {
          width: '100%',
        },
      },
      defaultValue: [],
      fieldName: 'factoryId',
      label: '园区/厂房',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: '租户名称',
    },
    {
      component: 'Input',
      fieldName: 'tenantPhone',
      label: '联系电话',
    },
    {
      component: 'Select',
      componentProps: {
        options: REPAIR_TYPE_OPTIONS,
      },
      fieldName: 'repairType',
      label: '报修类型',
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: REPAIR_PRIORITY_OPTIONS,
        optionType: 'button',
      },
      defaultValue: '普通',
      fieldName: 'priority',
      label: '优先级',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: REPAIR_STATUS_OPTIONS,
      },
      defaultValue: '待接单',
      fieldName: 'status',
      label: '工单状态',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'assignee',
      label: '维修人员',
    },
    {
      component: 'Input',
      fieldName: 'assigneePhone',
      label: '维修人员电话',
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 500,
        rows: 4,
        showCount: true,
      },
      fieldName: 'description',
      label: '问题描述',
      rules: z
        .string()
        .min(1, '请输入问题描述')
        .max(500, '问题描述不能超过500字'),
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 500,
        rows: 4,
        showCount: true,
      },
      fieldName: 'processRemark',
      label: '处理说明',
      rules: z.string().max(500, '处理说明不能超过500字').optional(),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getParkList,
        class: 'w-full',
        labelField: 'parkName',
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      label: $t('page.common.park'),
    },
    {
      component: 'ApiCascader',
      componentProps: {
        api: getFactoryListByParkId,
        changeOnSelect: false,
        expandTrigger: 'hover',
        placeholder: '请选择园区和厂房',
        style: {
          width: '100%',
        },
      },
      fieldName: 'factoryId',
      label: '厂房名称',
    },
    {
      component: 'Input',
      fieldName: 'orderNo',
      label: '工单编号',
    },
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: '租户名称',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: REPAIR_TYPE_OPTIONS,
      },
      fieldName: 'repairType',
      label: '报修类型',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: REPAIR_STATUS_OPTIONS,
      },
      fieldName: 'status',
      label: '工单状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: REPAIR_PRIORITY_OPTIONS,
      },
      fieldName: 'priority',
      label: '优先级',
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'createTimeRange',
      label: '提交时间',
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'orderNo',
      fixed: 'left',
      minWidth: 160,
      title: '工单编号',
    },
    {
      field: 'source',
      minWidth: 120,
      title: '来源',
    },
    {
      field: 'park',
      minWidth: 140,
      title: '园区',
    },
    {
      field: 'factory',
      minWidth: 150,
      title: '厂房',
    },
    {
      field: 'tenantName',
      minWidth: 140,
      title: '租户',
    },
    {
      field: 'repairType',
      minWidth: 100,
      title: '类型',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'default', label: '普通', value: '普通' },
          { color: 'red', label: '紧急', value: '紧急' },
        ],
      },
      field: 'priority',
      minWidth: 100,
      title: '优先级',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'warning', label: '待接单', value: '待接单' },
          { color: 'processing', label: '处理中', value: '处理中' },
          { color: 'blue', label: '待验收', value: '待验收' },
          { color: 'success', label: '已完成', value: '已完成' },
          { color: 'default', label: '已取消', value: '已取消' },
        ],
      },
      field: 'status',
      minWidth: 110,
      title: '状态',
    },
    {
      field: 'assignee',
      minWidth: 120,
      title: '维修人员',
    },
    {
      field: 'createTime',
      formatter: ({ cellValue }) =>
        cellValue ? formatDateTime(cellValue) : '',
      minWidth: 180,
      title: '提交时间',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'orderNo',
          nameTitle: '工单编号',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 150,
      title: '操作',
    },
  ];
}
