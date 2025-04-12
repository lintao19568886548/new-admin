import type { RentalManagementItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { markRaw } from 'vue';

import dayjs from 'dayjs'; // 添加 dayjs 导入

import { z } from '#/adapter/form';
import { $t } from '#/locales';

import MultiSelect from './modules/multi-select.vue';

/**
 * 获取表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('system.rental.title'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'price',
      label: $t('system.rental.price'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'area',
      label: $t('system.rental.area'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.address'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'contact',
      label: $t('system.rental.contact'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'availableArea',
      label: $t('system.rental.status.label'),
      rules: 'required',
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
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('system.rental.title'),
    },
    {
      component: markRaw(MultiSelect),
      disabledOnChangeListener: false,
      fieldName: 'price',
      formItemClass: 'col-span-1',
      label: $t('system.rental.price'),
    },
    {
      component: markRaw(MultiSelect),
      disabledOnChangeListener: false,
      fieldName: 'area',
      label: $t('system.rental.area'),
    },
    // 修改为输入框
    {
      component: markRaw(MultiSelect),
      disabledOnChangeListener: false,
      fieldName: 'availableArea',
      label: $t('system.rental.status.label'),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.address'),
    },
    {
      component: 'Input',
      fieldName: 'contact',
      label: $t('system.rental.contact'),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = RentalManagementItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'title',
      title: $t('system.rental.title'),
      width: 150,
    },
    {
      field: 'price',
      title: $t('system.rental.price'),
      width: 120,
    },
    {
      field: 'area',
      formatter: ({ cellValue }) => {
        if (cellValue === undefined || cellValue === null) return '';
        if (Number.isNaN(Number(cellValue))) return cellValue; // 处理非纯数值类型
        return `${cellValue}m²`;
      },
      title: $t('system.rental.area'),
      width: 120,
    },
    {
      cellRender: {
        name: 'CellAreaTag',
      },
      field: 'availableArea',
      title: $t('system.rental.status.label'),
      width: 100,
    },
    {
      field: 'address',
      minWidth: 200,
      title: $t('system.rental.address'),
    },
    {
      field: 'contact',
      title: $t('system.rental.contact'),
      width: 150,
    },
    {
      field: 'createTime',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD');
      },
      title: $t('system.rental.createTime'),
      width: 120,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'title',
          nameTitle: $t('system.rental.name'),
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
