import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import dayjs from 'dayjs';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'green',
      label: $t('system.rental.tenant.status.current'),
      value: '当期',
    },
    {
      color: 'red',
      label: $t('system.rental.tenant.status.expired'),
      value: '过期',
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
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: $t('system.rental.tenant.phone'),
      rules: 'required',
    },
    // 删除重复的 RangePicker
    {
      component: 'DatePicker', // 使用 DatePicker 而不是 RangePicker
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: '请选择合同日期',
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD', // 简化日期格式
      },
      fieldName: 'contractDate',
      label: $t('system.rental.tenant.contractDate'),
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: '请选择涨租日期',
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD', // 简化日期格式
      },
      fieldName: 'increaseDate',
      label: $t('system.rental.tenant.increaseDate'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        max: 100,
        min: 0,
        precision: 1,
        style: { width: '100%' },
      },
      fieldName: 'increaseRate',
      label: $t('system.rental.tenant.increaseRate'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.tenant.address'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('system.rental.tenant.status.current'), value: '当期' },
          { label: $t('system.rental.tenant.status.expired'), value: '过期' },
        ],
        optionType: 'button',
      },
      defaultValue: '当期',
      fieldName: 'status',
      label: $t('system.rental.tenant.status.label'),
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
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: $t('system.rental.tenant.phone'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('system.rental.tenant.status.current'), value: '当期' },
          { label: $t('system.rental.tenant.status.expired'), value: '过期' },
        ],
      },
      fieldName: 'status',
      label: $t('system.rental.tenant.status.label'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'contractDate',
      label: $t('system.rental.tenant.contractDate'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD', // 指定输出格式
      },
      fieldName: 'contractDate',
      label: $t('system.rental.tenant.contractDate'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD', // 指定输出格式
      },
      fieldName: 'increaseDate',
      label: $t('system.rental.tenant.increaseDate'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        max: 100,
        min: 0,
        precision: 1,
        style: { width: '100%' },
      },
      fieldName: 'increaseRate',
      label: $t('system.rental.tenant.increaseRate'),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.tenant.address'),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = any>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'tenantName',
      title: $t('system.rental.tenant.name'),
      width: 100,
    },
    {
      field: 'phoneNumber',
      title: $t('system.rental.tenant.phone'),
      width: 130,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'status',
      title: $t('system.rental.tenant.status.label'),
      width: 80,
    },
    {
      field: 'contractDate',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD');
      },
      title: $t('system.rental.tenant.contractDate'),
      width: 120,
    },
    {
      field: 'increaseDate',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD');
      },
      title: $t('system.rental.tenant.increaseDate'),
      width: 120,
    },
    {
      field: 'increaseRate',
      formatter: ({ cellValue }) => {
        return cellValue ? `${cellValue}%` : '';
      },
      title: $t('system.rental.tenant.increaseRate'),
      width: 100,
    },
    {
      field: 'address',
      minWidth: 180,
      title: $t('system.rental.tenant.address'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'tenantName',
          nameTitle: $t('system.rental.tenant.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'view',
            text: '查看',
          },
          'edit', // 默认的编辑按钮
          'delete', // 默认的删除按钮
        ],
      },
      field: 'operation',
      fixed: 'right',
      title: $t('system.rental.operation'),
      width: 150,
    },
  ];
}
