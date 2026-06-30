import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import dayjs from 'dayjs';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      defaultValue: [
        dayjs().format('YYYY-MM-DD'),
        dayjs().format('YYYY-MM-DD'),
      ],
      fieldName: 'freezeTime',
      label: '冻结时间',
    },
    {
      component: 'Input',
      fieldName: 'comAddress',
      label: '电表编号',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '小时冻结数据', value: 1 },
          { label: '日冻结数据', value: 2 },
          { label: '月冻结数据', value: 3 },
        ],
      },
      defaultValue: 2,
      fieldName: 'type',
      label: '数据类型',
    },
  ];
}

export function useColumns(): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'piplineName',
      minWidth: 220,
      title: '设备地址',
    },
    {
      field: 'comAddress',
      minWidth: 160,
      title: '设备编号',
    },

    {
      field: 'dataValue',
      minWidth: 120,
      title: '总用电费(度)',
    },
    {
      field: 'dataValue1',
      minWidth: 100,
      title: '尖',
    },
    {
      field: 'dataValue2',
      minWidth: 100,
      title: '峰',
    },
    {
      field: 'dataValue3',
      minWidth: 100,
      title: '平',
    },
    {
      field: 'dataValue4',
      minWidth: 100,
      title: '谷',
    },
    {
      field: 'dataItemName',
      minWidth: 120,
      title: '冻结类型',
    },
    {
      field: 'freezeTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 180,
      title: '冻结时间',
    },
    {
      field: 'writeTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 180,
      title: '写入时间',
    },
  ];
}
