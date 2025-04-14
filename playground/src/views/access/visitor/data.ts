import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';

import dayjs from 'dayjs'; // 添加 dayjs 导入

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
      label: $t('system.access.visitor.status.in'),
      value: 0, // 修改为数字，与数据库保持一致
    },
    {
      color: 'processing',
      label: $t('system.access.visitor.status.left'),
      value: 1, // 修改为数字，与数据库保持一致
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
      fieldName: 'visitorName',
      label: '姓名',
      rules: z
        .string()
        .min(2, $t('ui.formRules.minLength', ['姓名', 2]))
        .max(20, $t('ui.formRules.maxLength', ['姓名', 20])),
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: '手机号',
      rules: z
        .string()
        .min(11, $t('ui.formRules.minLength', ['手机号', 11]))
        .max(11, $t('ui.formRules.maxLength', ['手机号', 11])),
    },
    {
      component: 'Input',
      fieldName: 'carNum', // 修改为与数据库字段匹配
      label: '车牌号',
      rules: z
        .string()
        .max(10, $t('ui.formRules.maxLength', ['车牌号', 10]))
        .optional(),
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择登记时间',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss', // 使用valueFormat指定输出格式
      },
      fieldName: 'registerTime',
      label: '登记时间',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '进入', value: '进入' },
          { label: '离开', value: '离开' },
        ],
        optionType: 'button',
      },
      defaultValue: '进入',
      fieldName: 'status',
      label: '访问状态',
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
        maxLength: 200,
        rows: 3,
        showCount: true,
        style: {
          width: '100%',
        },
      },
      fieldName: 'remark', // 修改为与数据库字段匹配
      label: '来访原因',
      rules: z
        .string()
        .max(200, $t('ui.formRules.maxLength', ['来访原因', 200]))
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
      fieldName: 'visitorName',
      label: '姓名',
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: '手机号',
    },
    {
      component: 'Input',
      fieldName: 'carNum', // 修改为与数据库字段匹配
      label: '车牌号',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '进入', value: '进入' },
          { label: '离开', value: '离开' },
        ],
      },
      fieldName: 'status',
      label: '访问状态',
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD', // 使用valueFormat指定输出格式
      },
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
export function useColumns<T = SystemDeptApi.SystemDept>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      align: 'center',
      field: 'visitorName',
      fixed: 'left',
      title: '姓名',
      width: 150,
    },
    {
      field: 'remark',
      title: '来访原因',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'status',
      formatter: ({ cellValue }) => {
        // 添加格式化函数，将数字转换为文字
        if (cellValue === 0) return '进入';
        if (cellValue === 1) return '离开';
        return cellValue;
      },
      title: '访问状态',
      width: 100,
    },
    {
      field: 'carNum',
      title: '车牌号',
      width: 150,
    },
    {
      field: 'phoneNumber',
      title: '手机号',
      width: 150,
    },
    {
      field: 'registerTime',
      formatter: ({ cellValue }) => {
        // 添加格式化函数，将ISO时间格式转换为更友好的格式
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD HH:mm:ss');
      },
      title: '登记时间',
      width: 180,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'visitorName',
          nameTitle: '姓名',
          onClick: onActionClick,
        },
        name: 'CellOperation',
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
