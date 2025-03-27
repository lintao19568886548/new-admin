import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'green',
      label: '进入',
      value: 1,
    },
    {
      color: 'processing',
      label: '离开',
      value: 0,
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
      fieldName: 'carNumber',
      label: '车牌号',
      rules: z
        .string()
        .min(2, $t('ui.formRules.minLength', ['车牌号', 2]))
        .max(20, $t('ui.formRules.maxLength', ['车牌号', 20])),
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择登记时间',
        showTime: true,
        style: { width: '100%' },
      },
      fieldName: 'registerTime',
      label: '登记时间',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '进入', value: 1 },
          { label: '离开', value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'accessStatus',
      label: '出入状态',
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 50,
        rows: 3,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'remark',
      label: '备注',
      rules: z
        .string()
        .max(50, $t('ui.formRules.maxLength', ['备注', 50]))
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
      fieldName: 'carNumber',
      label: '车牌号',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '进入', value: 1 },
          { label: '离开', value: 0 },
        ],
      },
      fieldName: 'accessStatus',
      label: '出入状态',
    },
    {
      component: 'RangePicker',
      fieldName: 'registerTime',
      label: '登记时间',
    },
  ];
}

/**
 * 获取表格列配置
 * @description 使用函数的形式返回列数据而不是直接export一个Array常量，是为了响应语言切换时重新翻译表头
 * @param onActionClick 表格操作按钮点击事件
 */
export function useColumns(
  onActionClick?: OnActionClickFn<SystemDeptApi.SystemDept>,
): VxeTableGridOptions<SystemDeptApi.SystemDept>['columns'] {
  return [
    {
      align: 'center',
      field: 'carNumber',
      fixed: 'left',
      title: '车牌号',
      width: 150,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'accessStatus',
      title: '出入状态',
      width: 100,
    },
    {
      field: 'registerTime',
      title: '登记时间',
      width: 180,
    },
    {
      field: 'remark',
      title: '备注',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'carNumber',
          nameTitle: '车牌号',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'view',
            text: '查看',
          },
          'edit',
          'delete',
        ],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 200,
    },
  ];
}
