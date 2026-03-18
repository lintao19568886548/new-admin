import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getFactoryListByParkId } from '#/api/factory'; // 确保导入
import { getParkList } from '#/api/park';
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
      componentProps: {
        placeholder: '请输入检查项目详情',
        showCount: true,
      },
      fieldName: 'checkItems',
      label: '检查项目',
      rules: z
        .string()
        .nonempty('检查项目不能为空')
        .max(500, '检查项目最多500个字符'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '合格', value: '合格' },
          { label: '不合格', value: '不合格' },
        ],
        optionType: 'button',
      },
      defaultValue: '合格',
      fieldName: 'checkResult',
      label: '检查结果',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'checker',
      label: '检查人', // $t('system.rental.checker') 似乎不适用，直接用中文
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择检查日期',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'checkDate', // 修改: checkTime -> checkDate
      label: '检查日期', // $t('page.maintenance.checkTime') -> '检查日期'
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
      componentProps: {
        placeholder: '请输入检查项目关键字',
      },
      fieldName: 'checkItems',
      label: '检查项目',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '合格', value: '合格' },
          { label: '不合格', value: '不合格' },
        ],
        placeholder: '请选择检查结果',
      },
      fieldName: 'checkResult',
      label: '检查结果',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入检查人',
      },
      fieldName: 'checker',
      label: '检查人',
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'checkDate', // 修改: checkTime -> checkDate
      label: '检查日期', // $t('page.maintenance.checkTime') -> '检查日期'
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
      field: 'checkItems',
      minWidth: 200,
      title: '检查项目',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          // 根据实际 checkResult 的值来定义颜色和标签
          { color: 'green', label: '合格', value: '合格' },
          { color: 'red', label: '不合格', value: '不合格' },
        ],
      },
      field: 'checkResult',
      minWidth: 100,
      title: '检查结果',
    },
    {
      field: 'checker',
      minWidth: 100,
      title: '检查人', // $t('system.rental.checker') -> '检查人'
    },
    {
      field: 'checkDate', // 修改: checkTime -> checkDate
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 180,
      title: '检查日期', // $t('page.maintenance.checkTime') -> '检查日期'
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
          // nameField: 'firefightingName', // 修改: 使用 hygieneCheckId 或其他合适的字段
          nameField: 'hygieneCheckId', // 或者用一个更友好的组合字段，如果后端提供
          nameTitle: '卫生检查记录', // $t('system.rental.name') -> '卫生检查记录'
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
      title: $t('system.rental.operation'), // 可保持或修改为 '操作'
    },
  ];
}
