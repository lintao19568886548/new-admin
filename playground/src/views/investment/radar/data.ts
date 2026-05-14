import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';

import { getParkList } from '#/api/park';

export interface RadarLead {
  enterpriseName: string;
  intentArea?: null | number;
  intentScore: number;
  latestContactTime?: null | string;
  latestSignalTime?: null | string;
  latestSignalType?: null | string;
  leadId: number;
  leadSource: string;
  matchScore: number;
  ownerName?: string;
  parkName?: string;
  phoneNumber?: null | string;
  priorityLevel: string;
  reachableScore: number;
  stage: string;
  totalScore: number;
}

export const RADAR_STAGE_LABEL_MAP: Record<string, string> = {
  CONTACTED: '已触达',
  DEAL: '成交',
  INVALID: '失效',
  NEW: '新建',
  PENDING_CONTACT: '待触达',
  REPLIED: '已回复',
  VISIT: '带看',
};

export const RADAR_STAGE_OPTIONS = [
  { label: '新建', value: 'NEW' },
  { label: '待触达', value: 'PENDING_CONTACT' },
  { label: '已触达', value: 'CONTACTED' },
  { label: '已回复', value: 'REPLIED' },
  { label: '带看', value: 'VISIT' },
  { label: '成交', value: 'DEAL' },
  { label: '失效', value: 'INVALID' },
];

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
      label: '园区',
    },
    {
      component: 'Input',
      fieldName: 'keyword',
      label: '关键字',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: 'A 级', value: 'A' },
          { label: 'B 级', value: 'B' },
          { label: 'C 级', value: 'C' },
        ],
      },
      fieldName: 'priorityLevel',
      label: '优先级',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: RADAR_STAGE_OPTIONS,
      },
      fieldName: 'stage',
      label: '阶段',
    },
  ];
}

export function useColumns<T = RadarLead>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'enterpriseName',
      minWidth: 220,
      title: '企业名称',
    },
    {
      field: 'parkName',
      minWidth: 120,
      title: '园区',
    },
    {
      field: 'phoneNumber',
      minWidth: 130,
      title: '联系电话',
    },
    {
      field: 'latestSignalType',
      minWidth: 120,
      title: '最近信号',
    },
    {
      field: 'intentArea',
      formatter: ({ cellValue }) =>
        cellValue ? `${Number(cellValue).toFixed(0)}㎡` : '-',
      minWidth: 120,
      title: '意向面积',
    },
    {
      field: 'intentScore',
      minWidth: 100,
      title: '意图分',
    },
    {
      field: 'matchScore',
      minWidth: 100,
      title: '匹配分',
    },
    {
      field: 'reachableScore',
      minWidth: 110,
      title: '可触达分',
    },
    {
      field: 'totalScore',
      minWidth: 100,
      title: '总分',
    },
    {
      field: 'priorityLevel',
      minWidth: 90,
      title: '优先级',
    },
    {
      field: 'stage',
      formatter: ({ cellValue }) =>
        cellValue ? RADAR_STAGE_LABEL_MAP[String(cellValue)] || cellValue : '-',
      minWidth: 140,
      title: '当前阶段',
    },
    {
      field: 'ownerName',
      minWidth: 120,
      title: '负责人',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'enterpriseName',
          nameTitle: '企业名称',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['查看'],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 100,
      title: '操作',
    },
  ];
}
