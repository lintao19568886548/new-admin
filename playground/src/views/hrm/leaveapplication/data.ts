import type { Ref } from 'vue';

import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { LeaveApplication, Park } from '#/api/hrm/leaveapplication';

export function useColumns(): VxeTableGridOptions<LeaveApplication>['columns'] {
  return [
    {
      field: 'user',
      title: '申请人',
      width: 120,
    },
    {
      field: 'park',
      title: '所在园区',
      width: 150,
    },
    {
      field: 'startDate',
      formatter: ({ cellValue }) => (cellValue ? cellValue.split('T')[0] : ''),
      title: '开始日期',
      width: 150,
    },
    {
      field: 'endDate',
      formatter: ({ cellValue }) => (cellValue ? cellValue.split('T')[0] : ''),
      title: '结束日期',
      width: 150,
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

export function useSearchSchema(parkOptions: Ref<Park[]>): VbenFormSchema[] {
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
      component: 'Select',
      componentProps: {
        fieldNames: {
          label: 'parkName',
          value: 'parkName',
        },
        options: parkOptions,
        placeholder: '请选择所在园区',
      },
      fieldName: 'park',
      label: '所在园区',
    },
  ];
}
