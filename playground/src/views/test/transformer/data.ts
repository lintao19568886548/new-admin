import type { TransformerItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

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
      label: $t('system.maintenance.transformer.status.normal'),
      value: '正常',
    },
    {
      color: 'red',
      label: $t('system.maintenance.transformer.status.abnormal'),
      value: '异常',
    },
    {
      color: 'processing',
      label: $t('system.maintenance.transformer.status.maintenance'),
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
      fieldName: 'title',
      label: $t('system.maintenance.transformer.title'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'specifications',
      label: $t('system.maintenance.transformer.specifications'),
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
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          {
            label: $t('system.maintenance.transformer.status.normal'),
            value: '正常',
          },
          {
            label: $t('system.maintenance.transformer.status.abnormal'),
            value: '异常',
          },
          {
            label: $t('system.maintenance.transformer.status.maintenance'),
            value: '维护',
          },
        ],
        optionType: 'button',
      },
      defaultValue: '正常',
      fieldName: 'status',
      label: $t('system.maintenance.transformer.status.label'),
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
      label: $t('system.maintenance.transformer.remark'),
      rules: z
        .string()
        .max(
          300,
          $t('ui.formRules.maxLength', [
            $t('system.maintenance.transformer.remark'),
            300,
          ]),
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
      label: $t('system.maintenance.transformer.title'),
    },
    {
      component: 'Input',
      fieldName: 'specifications',
      label: $t('system.maintenance.transformer.specifications'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          {
            label: $t('system.maintenance.transformer.status.normal'),
            value: '正常',
          },
          {
            label: $t('system.maintenance.transformer.status.abnormal'),
            value: '异常',
          },
          {
            label: $t('system.maintenance.transformer.status.maintenance'),
            value: '维护',
          },
        ],
      },
      fieldName: 'status',
      label: $t('system.maintenance.transformer.status.label'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('system.maintenance.transformer.remark'),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: $t('system.rental.address'),
    },
    {
      component: 'RangePicker',
      fieldName: 'checkTime',
      label: $t('page.maintenance.checkTime'),
    },
  ];
}

/**
 * 获取表格列配置
 */
export function useColumns<T = TransformerItem>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'title',
      minWidth: 150,
      title: $t('system.maintenance.transformer.title'),
    },
    {
      field: 'specifications',
      minWidth: 120,
      title: $t('system.maintenance.transformer.specifications'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'status',
      minWidth: 100,
      title: $t('system.maintenance.transformer.status.label'),
    },
    {
      field: 'remark',
      minWidth: 150,
      title: $t('system.maintenance.transformer.remark'),
    },
    {
      field: 'address',
      minWidth: 200,
      title: $t('system.rental.address'),
    },
    {
      field: 'contact',
      minWidth: 150,
      title: $t('system.rental.contact'),
    },
    {
      field: 'checkTime',
      minWidth: 120,
      title: $t('page.maintenance.checkTime'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'title',
          nameTitle: $t('system.maintenance.transformer.name'),
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
