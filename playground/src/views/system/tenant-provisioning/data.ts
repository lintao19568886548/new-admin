import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { TenantProvisioningAdminApi } from '#/api/system/tenant-provisioning';

import { formatDateTime } from '@vben/utils';

export function formatNullableDate(value?: null | string) {
  return value ? formatDateTime(value) : '-';
}

export function formatMoney(amountTotal?: number) {
  return `¥${(Number(amountTotal || 0) / 100).toFixed(2)}`;
}

export function getJobStatusColor(status?: string) {
  if (status === 'failed_manual') {
    return 'error';
  }
  if (status === 'pending' || status === 'provisioning') {
    return 'processing';
  }
  if (status === 'active') {
    return 'success';
  }
  return 'default';
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: {
        max: 100,
        min: 1,
        placeholder: '1-100',
      },
      defaultValue: 50,
      fieldName: 'limit',
      label: '读取数量',
    },
  ];
}

export function useColumns(
  onActionClick: OnActionClickFn<TenantProvisioningAdminApi.FailedManualJob>,
): VxeTableGridOptions<TenantProvisioningAdminApi.FailedManualJob>['columns'] {
  return [
    {
      field: 'id',
      minWidth: 90,
      title: 'Job',
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'error',
            label: 'failed_manual',
            value: 'failed_manual',
          },
        ],
      },
      field: 'status',
      minWidth: 140,
      title: '状态',
    },
    {
      field: 'organization.name',
      formatter: ({ row }) => row.organization?.name || '-',
      minWidth: 180,
      title: '组织',
    },
    {
      field: 'sourceOrgId',
      formatter: ({ cellValue }) => cellValue || '-',
      minWidth: 110,
      title: 'sourceOrgId',
    },
    {
      field: 'targetCustomerId',
      formatter: ({ cellValue }) => cellValue || '-',
      minWidth: 160,
      title: '目标租户',
    },
    {
      field: 'step',
      formatter: ({ cellValue }) => cellValue || '-',
      minWidth: 170,
      title: '失败步骤',
    },
    {
      field: 'initiator.username',
      formatter: ({ row }) =>
        row.initiator?.realName || row.initiator?.username || '-',
      minWidth: 150,
      title: '发起人',
    },
    {
      field: 'lastPayment.amountTotal',
      formatter: ({ row }) =>
        row.lastPayment ? formatMoney(row.lastPayment.amountTotal) : '-',
      minWidth: 110,
      title: '支付金额',
    },
    {
      field: 'retryCount',
      minWidth: 90,
      title: '重试',
    },
    {
      field: 'updateTime',
      formatter: ({ cellValue }) => formatNullableDate(cellValue),
      minWidth: 180,
      title: '更新时间',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'id',
          nameTitle: '任务',
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: [
          {
            code: 'requeue',
            text: '处理',
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
