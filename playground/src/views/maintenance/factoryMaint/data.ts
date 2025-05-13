import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getFactoryListByParkId } from '#/api/factory'; // 确保导入
// 新增导入 (如果之前没有)
// <-- 新增导入
import { $t } from '#/locales';

/**
 * 获取新增、修改表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
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
      defaultValue: [], // 值将是 [parkId, factoryId]
      fieldName: 'factoryId', // 注意：此字段将持有数组值
      label: '厂房名称',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'maintenanceItem',
      label: '维护项目', // New field
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '正常', value: '正常' },
          { label: '异常', value: '异常' },
          { label: '维护', value: '维护' },
        ],
        optionType: 'button',
      },
      defaultValue: '正常',
      fieldName: 'maintenanceStatus', // New field
      label: '维护状态', // New field
    },
    {
      component: 'Input',
      fieldName: 'personInCharge', // Renamed from checker
      label: '负责人', // Updated label, consider using $t
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择开始时间',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'startTime', // Renamed from checkTime
      label: '开始时间', // Updated label, consider using $t
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择结束时间 (可选)',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'endTime', // New field
      label: '结束时间', // New field
      // rules: 'required', // Optional, so no 'required' rule
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 300,
        rows: 5,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'remark',
      label: $t('page.common.remark'),
      rules: z
        .string()
        .max(300, $t('ui.formRules.maxLength', [$t('page.common.remark'), 300]))
        .optional(),
    },
  ];
}

/**
 * 获取表格查询表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
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
      fieldName: 'factoryId', // 注意：此字段将持有数组值
      label: '厂房名称',
    },
    {
      component: 'Input',
      fieldName: 'maintenanceItem', // New field
      label: '维护项目',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '正常', value: '正常' },
          { label: '异常', value: '异常' },
          { label: '维护', value: '维护' },
        ],
      },
      fieldName: 'maintenanceStatus', // New field
      label: '维护状态',
    },
    {
      component: 'Input',
      fieldName: 'personInCharge', // New field
      label: '负责人',
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'maintenancePeriod', // New field for date range, maps to startTime and endTime
      label: '维护时段', // Updated label
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns(
  onActionClick: OnActionClickFn,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'park',
      minWidth: 150,
      title: $t('page.park.item'),
    },
    {
      field: 'factory',
      minWidth: 150,
      title: '厂房名称',
    },
    {
      field: 'maintenanceItem', // New column
      minWidth: 150,
      title: '维护项目',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'green', label: '正常', value: '正常' },
          { color: 'red', label: '异常', value: '异常' },
          { color: 'processing', label: '维护', value: '维护' },
        ],
      },
      field: 'maintenanceStatus', // New column
      minWidth: 120,
      title: '维护状态',
    },
    {
      field: 'personInCharge', // Renamed from checker
      minWidth: 150,
      title: '负责人', // Updated title
    },
    {
      field: 'startTime', // Renamed from checkTime
      formatter: ({ cellValue }) => {
        return cellValue ? formatDateTime(cellValue) : '';
      },
      minWidth: 180, // Adjusted width for datetime
      title: '开始时间', // Updated title
    },
    {
      field: 'endTime', // New column
      formatter: ({ cellValue }) => {
        return cellValue ? formatDateTime(cellValue) : '';
      },
      minWidth: 180, // Adjusted width for datetime
      title: '结束时间',
    },
    {
      field: 'remark',
      minWidth: 150,
      title: $t('page.common.remark'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'maintenanceItem', // Updated nameField
          nameTitle: '维护项目', // Updated nameTitle
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          'edit', // 默认的编辑按钮
          'delete', // 默认的删除按钮
        ],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 150,
      title: $t('system.rental.operation'),
    },
  ];
}
