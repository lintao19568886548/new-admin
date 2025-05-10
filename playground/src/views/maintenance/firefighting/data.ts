import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getFactoryListByParkId } from '#/api/factory'; // 确保导入
// 新增导入 (如果之前没有)
// <-- 新增导入
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

const parkCascaderOptions = await getFactoryListByParkId();

/**
 * 获取新增、修改表单的字段配置
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Cascader',
      componentProps: {
        changeOnSelect: false,
        expandTrigger: 'hover',
        fieldNames: {
          label: 'name',
          value: 'value',
          children: 'children',
        },
        // loadData: async (...) => { ... }, // <-- 移除此行及整个 loadData 函数
        options: parkCascaderOptions, // 数据将由 form.vue 动态填充
        placeholder: '请选择园区和厂房',
        style: { width: '100%' },
      },
      defaultValue: [], // 值将是 [parkId, factoryId]
      fieldName: 'factoryId', // 注意：此字段将持有数组值
      label: '厂房名称',
      rules: 'required',
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
      component: 'Cascader',
      componentProps: {
        changeOnSelect: false,
        expandTrigger: 'hover',
        fieldNames: {
          label: 'name',
          value: 'value',
          children: 'children',
        },
        // loadData: async (...) => { ... }, // <-- 移除此行及整个 loadData 函数
        options: parkCascaderOptions, // 数据将由 list.vue 动态填充
        placeholder: '请选择园区和厂房',
      },
      fieldName: 'factoryId', // 后端列表查询需要单个 factoryId
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
      field: 'factory',
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
