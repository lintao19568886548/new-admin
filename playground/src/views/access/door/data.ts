import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { DoorItem } from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn } from '#/adapter/vxe-table';

import dayjs from 'dayjs';

import { z } from '#/adapter/form';
import { getParkList } from '#/api/park';
import { $t } from '#/locales';

export const DOOR_STATUS_OPTIONS = [
  {
    label: '开启',
    value: 1,
  },
  {
    label: '关闭',
    value: 0,
  },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'deviceCode',
      label: '设备编号',
      rules: z
        .string()
        .min(4, $t('ui.formRules.minLength', ['设备编号', 4]))
        .max(30, $t('ui.formRules.maxLength', ['设备编号', 30])),
    },
    {
      component: 'Input',
      fieldName: 'deviceName',
      label: '门禁设备',
      rules: z
        .string()
        .min(2, $t('ui.formRules.minLength', ['门禁设备', 2]))
        .max(50, $t('ui.formRules.maxLength', ['门禁设备', 50])),
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
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'location',
      label: '所在地点',
      rules: z
        .string()
        .min(2, $t('ui.formRules.minLength', ['所在地点', 2]))
        .max(100, $t('ui.formRules.maxLength', ['所在地点', 100])),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: DOOR_STATUS_OPTIONS,
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: '开关状态',
    },
  ];
}

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
      component: 'Input',
      fieldName: 'deviceCode',
      label: '设备编号',
    },
    {
      component: 'Input',
      fieldName: 'deviceName',
      label: '门禁设备',
    },
    {
      component: 'Input',
      fieldName: 'location',
      label: '所在地点',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: DOOR_STATUS_OPTIONS,
      },
      fieldName: 'status',
      label: '开关状态',
    },
  ];
}

export function useColumns(
  onStatusChange: (newStatus: number, row: DoorItem) => Promise<boolean>,
  onActionClick: OnActionClickFn<DoorItem>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'deviceName',
      fixed: 'left',
      title: '门禁设备',
      width: 220,
    },
    {
      field: 'deviceCode',
      title: '设备编号',
      width: 160,
    },
    {
      field: 'parkName',
      title: '所属园区',
      width: 160,
    },
    {
      field: 'location',
      minWidth: 220,
      title: '所在地点',
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: 'CellSwitch',
        props: {
          checkedChildren: '开启',
          checkedValue: 1,
          unCheckedChildren: '关闭',
          unCheckedValue: 0,
        },
      },
      field: 'status',
      title: '开关状态',
      width: 120,
    },
    {
      field: 'updateTime',
      formatter: ({ cellValue }) => {
        if (!cellValue) return '';
        return dayjs(cellValue).format('YYYY-MM-DD HH:mm:ss');
      },
      title: '更新时间',
      width: 180,
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'deviceName',
          nameTitle: '门禁设备',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['delete'],
      },
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      title: '操作',
      width: 120,
    },
  ];
}
