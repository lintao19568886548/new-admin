import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MeterBrandOptionField, MeterType } from '#/api/smart-meter';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getMeterBrandSearchOptions } from '#/api/smart-meter';

// ===================== 品牌名称下拉选项 =====================
// 修改点：添加亿玛信诺到下拉框
export const BRAND_NAME_OPTIONS = [
  { label: '和众', value: '和众' },
  { label: '亿玛信诺', value: '亿玛信诺' },
];

export const BRAND_ENABLED_OPTIONS = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

export const BRAND_DEFAULT_OPTIONS = [
  { label: '当前选用', value: true },
  { label: '备选', value: false },
];

function createBrandSearchSchema(
  fieldName: MeterBrandOptionField,
  label: string,
  meterType: MeterType,
): VbenFormSchema {
  return {
    component: 'ApiAutoComplete',
    componentProps: {
      allowClear: true,
      alwaysLoad: true,
      api: getMeterBrandSearchOptions,
      class: 'w-full',
      filterOption: (inputValue: string, option: { value?: string }) => {
        const value = String(option?.value || '');
        return value.toLowerCase().includes(inputValue.toLowerCase());
      },
      optionFilterProp: 'value',
      params: {
        field: fieldName,
        meterType,
      },
      placeholder: `请输入或选择${label}`,
    },
    fieldName,
    label,
  };
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'brandName',
      label: '品牌名称',
      rules: z
        .string()
        .min(1, '请输入品牌名称')
        .max(100, '品牌名称不能超过100字'),
    },
    {
      component: 'Input',
      fieldName: 'brandCode',
      label: '品牌编码',
      rules: z
        .string()
        .min(1, '请输入品牌编码')
        .max(50, '品牌编码不能超过50字'),
    },
    {
      component: 'Input',
      fieldName: 'protocolType',
      label: '协议类型',
    },
    {
      component: 'Input',
      fieldName: 'apiEndpoint',
      label: '接口地址',
    },
    {
      component: 'Input',
      fieldName: 'appKey',
      label: '应用 Key',
    },
    {
      component: 'Input',
      fieldName: 'appSecretRef',
      label: '密钥引用',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: BRAND_ENABLED_OPTIONS,
        optionType: 'button',
      },
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用状态',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: BRAND_DEFAULT_OPTIONS,
        optionType: 'button',
      },
      defaultValue: false,
      fieldName: 'isDefault',
      label: '选用状态',
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 300,
        rows: 4,
        showCount: true,
      },
      fieldName: 'remark',
      label: '备注',
      rules: z.string().max(300, '备注不能超过300字').optional(),
    },
  ];
}

// ===================== 搜索表单配置 =====================
// 修改点：brandName 从 ApiAutoComplete 改为 Select，使用 BRAND_NAME_OPTIONS
export function useGridFormSchema(meterType: MeterType): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: BRAND_NAME_OPTIONS,
        placeholder: '请选择品牌名称',
        showSearch: true,
      },
      fieldName: 'brandName',
      label: '品牌名称',
    },
    createBrandSearchSchema('brandCode', '品牌编码', meterType),
    createBrandSearchSchema('protocolType', '协议类型', meterType),
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: BRAND_ENABLED_OPTIONS,
      },
      fieldName: 'enabled',
      label: '启用状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: BRAND_DEFAULT_OPTIONS,
      },
      fieldName: 'isDefault',
      label: '选用状态',
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'brandName',
      fixed: 'left',
      minWidth: 180,
      title: '品牌名称',
    },
    {
      field: 'brandCode',
      minWidth: 150,
      title: '品牌编码',
    },
    {
      field: 'protocolType',
      minWidth: 140,
      title: '协议类型',
    },
    {
      field: 'apiEndpoint',
      minWidth: 220,
      title: '接口地址',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'success', label: '启用', value: true },
          { color: 'default', label: '停用', value: false },
        ],
      },
      field: 'enabled',
      minWidth: 100,
      title: '启用状态',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'processing', label: '当前选用', value: true },
          { color: 'default', label: '备选', value: false },
        ],
      },
      field: 'isDefault',
      minWidth: 110,
      title: '选用状态',
    },
    {
      field: 'updateTime',
      formatter: ({ cellValue }) =>
        cellValue ? formatDateTime(cellValue) : '',
      minWidth: 180,
      title: '更新时间',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'brandName',
          nameTitle: '品牌名称',
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
