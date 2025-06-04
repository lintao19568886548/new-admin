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
      fieldName: 'name',
      label: '电梯名称',
      rules: 'required',
    },
    {
      component: 'Input', // 或者使用 InputNumber 如果需要数字输入
      fieldName: 'area',
      label: '面积',
      // rules: 'required', // 根据业务需求决定是否必填，以及具体校验规则
    },
    {
      component: 'Input', // 或者使用 InputNumber 如果需要数字输入
      fieldName: 'loadCapacity',
      label: '承重',
      // rules: 'required', // 根据业务需求决定是否必填，以及具体校验规则
    },
    {
      component: 'Input',
      fieldName: 'brand',
      label: '品牌',
      // rules: 'required', // 根据业务需求决定是否必填
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
      fieldName: 'name',
      label: '电梯名称',
    },
    {
      component: 'Input',
      fieldName: 'area',
      label: '面积',
    },
    {
      component: 'Input',
      fieldName: 'loadCapacity',
      label: '承重',
    },
    {
      component: 'Input',
      fieldName: 'brand',
      label: '品牌',
    },
    {
      component: 'Input',
      fieldName: 'checker',
      label: $t('system.rental.checker'),
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
      field: 'name',
      minWidth: 150,
      title: '电梯名称',
    },
    {
      field: 'area',
      minWidth: 100,
      title: '面积',
    },
    {
      field: 'loadCapacity',
      minWidth: 100,
      title: '承重',
    },
    {
      field: 'brand',
      minWidth: 120,
      title: '品牌',
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
      minWidth: 180, // 调整宽度以适应日期时间格式
      title: $t('page.maintenance.checkTime'),
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
          nameField: 'name', // 更新为电梯名称字段
          nameTitle: '电梯名称',
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
