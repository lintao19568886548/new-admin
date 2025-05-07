import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import dayjs from 'dayjs';

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
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD',
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
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        precision: 2,
        style: { width: '100%' },
      },
      fieldName: 'increaseRate',
      label: $t('system.rental.tenant.increaseRate'),
    },
    // {
    //   component: markRaw(IncreaseForm),
    //   fieldName: 'increaseData', // 保持不变，已与接口一致
    //   // label: $t('page.rental.increaseData'),
    // },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.tenant.address'),
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
        placeholder: ['开始日期', '结束日期'],
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
      fieldName: 'increaseDate',
      label: $t('system.rental.tenant.increaseDate'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '%',
        precision: 2,
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

export function useIncreaseFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
    },
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('system.rental.tenant.name'),
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
      minWidth: 150,
      title: $t('system.rental.tenant.name'),
    },
    {
      field: 'phoneNumber',
      minWidth: 130,
      title: $t('system.rental.tenant.phone'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'status',
      minWidth: 80,
      title: $t('system.rental.tenant.status.label'),
    },
    {
      field: 'contractStart',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD');
      },
      minWidth: 100,
      title: $t('system.rental.tenant.contractStart'),
    },
    {
      field: 'contractEnd',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD');
      },
      minWidth: 100,
      title: $t('system.rental.tenant.contractEnd'),
    },
    {
      field: 'increaseDate',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD');
      },
      minWidth: 100,
      title: $t('system.rental.tenant.increaseDate'),
    },
    {
      field: 'increaseRate',
      formatter: ({ cellValue }) => {
        return cellValue ? `${cellValue}%` : '';
      },
      minWidth: 100,
      title: $t('system.rental.tenant.increaseRate'),
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
      minWidth: 150,
      title: $t('system.rental.operation'),
    },
  ];
}
