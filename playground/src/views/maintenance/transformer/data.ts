import type { TransformerItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getFactoryListByParkId } from '#/api';
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
      fieldName: 'specifications',
      label: $t('system.maintenance.transformer.specifications'),
      rules: 'required',
    },
    // {
    //   component: 'Input',
    //   fieldName: 'address',
    //   label: $t('system.rental.address'),
    //   rules: 'required',
    // },
    {
      component: 'Input',
      fieldName: 'checker',
      label: $t('system.rental.checker'),
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
      field: 'park',
      minWidth: 150,
      title: $t('page.park.item'),
    },
    {
      field: 'factoryName', // 修改为 factoryName 或实际对应的厂房名字段
      minWidth: 150,
      title: $t('厂房名称'), // 修改表头为厂房名称
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
      field: 'remark',
      minWidth: 150,
      title: $t('system.maintenance.transformer.remark'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'transformerName',
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
