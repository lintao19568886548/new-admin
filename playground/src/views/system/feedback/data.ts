import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemFeedbackApi } from '#/api/system/feedback';

import { formatDateTime } from '@vben/utils';

export const FEEDBACK_CATEGORY_OPTIONS: Array<{
  color: string;
  label: string;
  value: SystemFeedbackApi.FeedbackItem['category'];
}> = [
  {
    color: 'error',
    label: '问题异常',
    value: 'bug',
  },
  {
    color: 'processing',
    label: '体验优化',
    value: 'experience',
  },
  {
    color: 'success',
    label: '功能建议',
    value: 'feature',
  },
  {
    color: 'default',
    label: '其他反馈',
    value: 'other',
  },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: '内容/提交人/联系方式',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: FEEDBACK_CATEGORY_OPTIONS.map(({ label, value }) => ({
          label,
          value,
        })),
        placeholder: '全部类型',
      },
      fieldName: 'category',
      label: '反馈类型',
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: '提交时间',
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<SystemFeedbackApi.FeedbackItem>,
): VxeTableGridOptions<SystemFeedbackApi.FeedbackItem>['columns'] {
  return [
    {
      field: 'id',
      minWidth: 90,
      title: '编号',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: FEEDBACK_CATEGORY_OPTIONS,
      },
      field: 'category',
      minWidth: 120,
      title: '反馈类型',
    },
    {
      field: 'content',
      formatter: ({ cellValue }) => {
        const text = String(cellValue || '').trim();
        return text.length > 48 ? `${text.slice(0, 48)}...` : text || '-';
      },
      minWidth: 320,
      title: '反馈内容',
    },
    {
      field: 'realName',
      formatter: ({ row }) => row.realName || row.username || '-',
      minWidth: 140,
      title: '提交人',
    },
    {
      field: 'contact',
      formatter: ({ cellValue }) => cellValue || '-',
      minWidth: 160,
      title: '联系方式',
    },
    {
      field: 'clientPlatform',
      formatter: ({ cellValue }) => cellValue || '-',
      minWidth: 120,
      title: '客户端',
    },
    {
      field: 'imageCount',
      minWidth: 100,
      title: '图片数',
    },
    {
      field: 'createTime',
      formatter: ({ cellValue }) => formatDateTime(cellValue),
      minWidth: 180,
      title: '提交时间',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'id',
          nameTitle: '反馈',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'view',
            text: '查看',
          },
        ],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 100,
      title: '操作',
    },
  ];
}
