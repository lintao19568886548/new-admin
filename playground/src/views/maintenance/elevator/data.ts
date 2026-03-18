import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { markRaw } from 'vue';

import { formatDateTime } from '@vben/utils';

import { z } from '#/adapter/form';
import { getFactoryListByParkId } from '#/api/factory'; // 确保导入
import { getParkList } from '#/api/park';
// 新增导入 (如果之前没有)
// <-- 新增导入
import { $t } from '#/locales';

import SizeForm from './modules/size-form.vue';

// 电梯尺寸项类型定义
export interface ElevatorSizeItem {
  description?: string;
  height: string;
  length: string;
  width: string;
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
      fieldName: 'name',
      label: '电梯名称',
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
      fieldName: 'status',
      label: '电梯状态',
      rules: 'required',
    },
    {
      component: 'InputNumber', // 或者使用 InputNumber 如果需要数字输入
      componentProps: {
        addonAfter: '吨',
        style: {
          width: '100%',
        },
      },
      fieldName: 'loadCapacity',
      label: '承重',
      rules: 'required', // 根据业务需求决定是否必填，以及具体校验规则
    },
    {
      component: markRaw(SizeForm),
      fieldName: 'size',
      label: '尺寸',
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: '请选择生产日期',
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'productionDate',
      label: '生产日期',
      // rules: 'required', // 根据业务需求决定是否必填
    },
    {
      component: 'Input',
      fieldName: 'checker',
      label: $t('system.rental.checker'),
      rules: 'required',
    },
    // Removed duplicate productionDate
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
    // Removed duplicate productionDate
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
      fieldName: 'name',
      label: '电梯名称',
    },
    {
      component: 'Input',
      fieldName: 'status',
      label: '电梯状态',
    },
    {
      component: 'InputNumber',
      componentProps: {
        addonAfter: '吨',
      },
      fieldName: 'loadCapacity',
      label: '承重',
    },
    {
      component: 'Input',
      fieldName: 'size',
      label: '尺寸',
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
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['生产开始日期', '生产结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'productionDate',
      label: '生产日期',
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
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'green', label: '正常', value: '正常' },
          { color: 'red', label: '异常', value: '异常' },
          { color: 'processing', label: '维护', value: '维护' },
        ],
      },
      field: 'status',
      minWidth: 100,
      title: '电梯状态',
    },
    {
      field: 'loadCapacity',
      formatter: ({ cellValue }) => {
        return cellValue ? `${cellValue} 吨` : '';
      },
      minWidth: 100,
      title: '承重',
    },
    {
      field: 'size',
      minWidth: 150,
      title: '尺寸',
    },
    {
      field: 'productionDate',
      formatter: ({ cellValue }) => {
        // 仅格式化日期部分
        return formatDateTime(cellValue);
      },
      minWidth: 150,
      title: '生产日期',
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
      minWidth: 150, // 调整宽度以适应日期时间格式
      title: $t('page.maintenance.checkTime'),
    },
    {
      field: 'remark',
      minWidth: 100,
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
