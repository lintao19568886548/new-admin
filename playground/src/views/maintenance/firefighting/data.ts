import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getParkList } from '#/api/park';
import { $t } from '#/locales';

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'green',
      label: $t('system.rental.status.vacant'),
      value: '空闲',
    },
    {
      color: 'red',
      label: $t('system.rental.status.rented'),
      value: '已租',
    },
    {
      color: 'processing',
      label: $t('system.rental.status.maintenance'),
      value: '维护',
    },
  ];
}

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'firefightingName',
      label: $t('system.rental.title'),
      rules: 'required',
    },
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
      component: 'Input',
      fieldName: 'address',
      label: '地址',
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
      fieldName: 'extinguisher',
      label: '灭火器检查',
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
      fieldName: 'hydrant',
      label: '消防栓检查',
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
      fieldName: 'fireExit',
      label: '安全通道检查',
    },
    {
      component: 'Input',
      fieldName: 'checker',
      label: $t('system.rental.checker'),
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择日期',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'checkTime',
      label: $t('page.maintenance.checkTime'),
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
      fieldName: 'description',
      label: $t('system.rental.description'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [$t('system.rental.description'), 300]),
        )
        .optional(),
    },
  ];
}

/**
 * 获取表格查询表单配置
 */
/**
 * 获取表格查询表单配置
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'firefightingName',
      label: '厂房名称',
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
      fieldName: 'extinguisher',
      label: '灭火器检查',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        filterOptions: true,
        options: [
          { label: '正常', value: '正常' },
          { label: '异常', value: '异常' },
          { label: '维护', value: '维护' },
        ],
      },
      fieldName: 'hydrant',
      label: '消防栓检查',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        filterOptions: true,
        options: [
          { label: '正常', value: '正常' },
          { label: '异常', value: '异常' },
          { label: '维护', value: '维护' },
        ],
      },
      fieldName: 'fireExit',
      label: '安全通道检查',
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.address'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'checkTime',
      label: $t('page.maintenance.checkTime'),
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
      field: 'firefightingName',
      minWidth: 150,
      title: '厂房名称',
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
      field: 'extinguisher',
      minWidth: 120,
      title: '灭火器检查',
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
      field: 'hydrant',
      minWidth: 120,
      title: '消防栓检查',
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
      field: 'fireExit',
      minWidth: 120,
      title: '安全通道检查',
    },

    {
      field: 'address',
      minWidth: 200,
      title: $t('system.rental.address'),
    },
    {
      field: 'checker',
      minWidth: 150,
      title: $t('system.rental.checker'),
    },
    {
      field: 'checkTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 120,
      title: $t('page.maintenance.checkTime'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'firefightingName',
          nameTitle: $t('system.rental.name'),
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
