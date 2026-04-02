import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { LeaveApplication } from '#/api/hrm/leaveapplication';

import { formatDateTime } from '@vben/utils';

import {
  DEFAULT_LEAVE_TYPE,
  getLeaveTypeText,
  LEAVE_TYPE_OPTIONS,
} from '#/api/hrm/leaveapplication';
import { getParkList } from '#/api/park';

export function useColumns(): VxeTableGridOptions<LeaveApplication>['columns'] {
  return [
    {
      field: 'user',
      title: '申请人',
      width: 120,
    },
    {
      field: 'username',
      title: '最后操作人',
      width: 120,
    },
    {
      field: 'park',
      title: '所在园区',
      width: 150,
    },
    {
      field: 'leaveType',
      formatter: ({ cellValue }) => getLeaveTypeText(cellValue),
      title: '请假类型',
      width: 120,
    },
    {
      field: 'startDate',
      formatter: ({ cellValue }) =>
        cellValue ? formatDateTime(cellValue) : '',
      title: '开始时间',
      width: 180,
    },
    {
      field: 'endDate',
      formatter: ({ cellValue }) =>
        cellValue ? formatDateTime(cellValue) : '',
      title: '结束时间',
      width: 180,
    },
    {
      field: 'reason',
      showOverflow: true,
      title: '请假原因',
    },
    {
      field: 'status',
      slots: {
        default: 'status_cell',
      },
      title: '状态',
      width: 100,
    },
    {
      field: 'auditUser',
      title: '审核人',
      width: 120,
    },
    {
      field: 'reply',
      showOverflow: true,
      title: '审批意见',
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: {
        default: 'operation_cell',
      },
      title: '操作',
      width: 200,
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入申请人姓名',
      },
      fieldName: 'user',
      label: '申请人',
      rules: 'required',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: getParkList,
        labelField: 'parkName',
        placeholder: '请选择所在园区',
        style: { width: '100%' },
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      label: '所在园区',
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        placeholder: '请选择开始日期',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'startDate',
      label: '开始日期',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: false,
        options: [...LEAVE_TYPE_OPTIONS],
        placeholder: '请选择请假类型',
        style: { width: '100%' },
      },
      defaultValue: DEFAULT_LEAVE_TYPE,
      fieldName: 'leaveType',
      label: '请假类型',
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        placeholder: '请选择结束日期',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'endDate',
      label: '结束日期',
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入请假原因',
        rows: 4,
      },
      fieldName: 'reason',
      label: '请假原因',
      rules: 'required',
    },
  ];
}

export function useSearchSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '请输入申请人姓名',
      },
      fieldName: 'user',
      label: '申请人',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: getParkList,
        labelField: 'parkName',
        placeholder: '请选择所在园区',
        valueField: 'parkId',
      },
      fieldName: 'parkId',
      label: '所在园区',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [...LEAVE_TYPE_OPTIONS],
        placeholder: '请选择请假类型',
        style: { width: '100%' },
      },
      fieldName: 'leaveType',
      label: '请假类型',
    },
  ];
}
