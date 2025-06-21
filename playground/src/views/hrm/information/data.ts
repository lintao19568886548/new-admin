import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn } from '#/adapter/vxe-table';
import type { EmployeeApi } from '#/api/hrm/employee';

import { z } from '#/adapter/form';

/**
 * 员工表单的字段配置
 */
export function useSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: '姓名',
      rules: z
        .string()
        .min(2, '姓名长度不能少于 2 个字符')
        .max(20, '姓名长度不能超过 20 个字符'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '男', value: '男' },
          { label: '女', value: '女' },
        ],
        optionType: 'button',
      },
      defaultValue: '男',
      fieldName: 'gender',
      label: '性别',
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: '手机号',
      rules: z.string().regex(/^1[3-9]\d{9}$/, '请输入正确的手机号码'),
    },
    {
      component: 'Input',
      fieldName: 'idNumber',
      label: '身份证号',
      rules: z
        .string()
        .regex(
          /(^\d{15}$)|(^\d{18}$)|(^\d{17}([\dX])$)/i,
          '请输入正确的身份证号码',
        )
        .optional(),
    },
    {
      component: 'Input',
      fieldName: 'department',
      label: '部门',
      rules: z.string().optional(),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 100,
        min: 18,
      },
      fieldName: 'age',
      label: '年龄',
      rules: z.number().optional(),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '小学', value: '小学' },
          { label: '初中', value: '初中' },
          { label: '高中', value: '高中' },
          { label: '专科', value: '专科' },
          { label: '本科', value: '本科' },
          { label: '研究生', value: '研究生' },
          { label: '博士', value: '博士' },
        ],
      },
      fieldName: 'education',
      label: '学历',
      rules: z.string().optional(),
    },
    {
      component: 'DatePicker',
      componentProps: {
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'hireDate',
      label: '入职日期',
      rules: z.string().optional(),
    },
    {
      component: 'DatePicker',
      componentProps: {
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'leaveDate',
      label: '离职日期',
      rules: z.string().optional(),
    },
    {
      component: 'Input',
      fieldName: 'address',
      label: '地址',
      rules: z.string().optional(),
    },
    {
      component: 'Textarea',
      componentProps: {
        maxLength: 200,
        rows: 3,
        showCount: true,
      },
      fieldName: 'remark',
      label: '备注',
      rules: z.string().max(200, '备注长度不能超过 200 个字符').optional(),
    },
  ];
}

/**
 * 获取表格列配置
 * @param onActionClick 表格操作按钮点击事件
 */
export function useColumns(
  onActionClick?: OnActionClickFn<EmployeeApi.Employee>,
): VxeTableGridOptions<EmployeeApi.Employee>['columns'] {
  return [
    {
      field: 'name',
      fixed: 'left',
      title: '姓名',
      width: 100,
    },
    {
      field: 'gender',
      title: '性别',
      width: 80,
    },
    {
      field: 'phone',
      title: '手机号',
      width: 120,
    },
    {
      field: 'idNumber',
      title: '身份证号',
      width: 180,
    },
    {
      field: 'department',
      title: '部门',
      width: 120,
    },
    {
      field: 'age',
      title: '年龄',
      width: 80,
    },
    {
      field: 'education',
      title: '学历',
      width: 100,
    },
    {
      field: 'hireDate',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return cellValue.split('T')[0]; // 确保只显示年月日
      },
      title: '入职日期',
      width: 120,
    },
    {
      field: 'leaveDate',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return cellValue.split('T')[0]; // 确保只显示年月日
      },
      title: '离职日期',
      width: 120,
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'isDeleted',
      title: '是否离职',
      width: 100,
    },
    {
      field: 'createTime',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return cellValue.split('T')[0]; // 确保只显示年月日
      },
      title: '创建时间',
      width: 180,
    },
    {
      field: 'address',
      title: '地址',
      width: 200,
    },
    {
      field: 'remark',
      title: '备注',
      width: 200,
    },
    {
      align: 'right',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: '员工',
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
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 160,
    },
  ];
}

/**
 * 搜索表单配置
 */
export function useSearchSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入姓名',
      },
      fieldName: 'name',
      label: '姓名',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入手机号',
      },
      fieldName: 'phone',
      label: '手机号',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入部门',
      },
      fieldName: 'department',
      label: '部门',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入身份证号',
      },
      fieldName: 'idNumber',
      label: '身份证号',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '全部', value: '' },
          { label: '男', value: '男' },
          { label: '女', value: '女' },
        ],
        optionType: 'button',
      },
      defaultValue: '',
      fieldName: 'gender',
      label: '性别',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '全部', value: '' },
          { label: '小学', value: '小学' },
          { label: '初中', value: '初中' },
          { label: '高中', value: '高中' },
          { label: '专科', value: '专科' },
          { label: '本科', value: '本科' },
          { label: '研究生', value: '研究生' },
          { label: '博士', value: '博士' },
        ],
        placeholder: '请选择学历',
      },
      fieldName: 'education',
      label: '学历',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: '全部', value: '' },
          { label: '在职', value: 'false' },
          { label: '离职', value: 'true' },
        ],
        optionType: 'button',
      },
      defaultValue: '',
      fieldName: 'isDeleted',
      label: '是否离职',
    },
    {
      component: 'RangePicker',
      componentProps: {
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'hireDate',
      label: '入职日期',
    },
  ];
}
