import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemFinanceApi } from '#/api';

import { formatDateTime } from '@vben/utils';

import { $t } from '#/locales';

/**
 * 获取标签颜色
 */
export function getTagTypeOptions() {
  return [
    {
      color: 'red',
      label: $t('page.agent.level.veryHigh'),
      value: '很高',
    },
    {
      color: 'orange',
      label: $t('page.agent.level.high'),
      value: '高',
    },
    {
      color: 'blue',
      label: $t('page.agent.level.normal'),
      value: '一般',
    },
    {
      color: 'green',
      label: $t('page.agent.level.low'),
      value: '低',
    },
    {
      color: 'cyan',
      label: $t('page.agent.level.veryLow'),
      value: '很低',
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('page.tenant.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'agentName',
      label: $t('page.agent.name'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '很高', value: '很高' },
          { label: '高', value: '高' },
          { label: '一般', value: '一般' },
          { label: '低', value: '低' },
          { label: '很低', value: '很低' },
        ],
        style: { width: '25%' },
      },
      fieldName: 'intentLevel',
      label: $t('page.agent.intentLevel'),
    },
    {
      component: 'InputNumber',
      fieldName: 'intentArea',
      label: $t('page.agent.intentArea'),
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: '初步接洽', value: '初步接洽' },
          { label: '深入沟通', value: '深入沟通' },
          { label: '合同准备', value: '合同准备' },
          { label: '签约完成', value: '签约完成' },
        ],
        style: { width: '25%' },
      },
      fieldName: 'progress',
      label: $t('page.agent.progress'),
    },
    {
      component: 'Input',
      fieldName: 'phoneNumber',
      label: $t('page.agent.phone'),
      rules: 'required',
    },
    {
      component: 'DatePicker',
      componentProps: {
        format: 'YYYY-MM-DD HH:mm:ss',
        placeholder: '请选择日期',
        showTime: true,
        style: { width: '100%' },
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'meetingTime',
      label: $t('page.common.date'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('page.common.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'agentName',
      label: $t('page.agent.name'),
    },
    {
      component: 'Input',
      fieldName: 'tenantName',
      label: $t('page.tenant.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '很高', value: '很高' },
          { label: '高', value: '高' },
          { label: '一般', value: '一般' },
          { label: '低', value: '低' },
          { label: '很低', value: '很低' },
        ],
      },
      fieldName: 'intentLevel',
      label: $t('page.agent.intentLevel'),
    },
    {
      component: 'InputNumber',
      fieldName: 'minIntentArea',
      label: $t('page.agent.minIntentArea'),
    },
    {
      component: 'InputNumber',
      fieldName: 'maxIntentArea',
      label: $t('page.agent.maxIntentArea'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '初步接洽', value: '初步接洽' },
          { label: '深入沟通', value: '深入沟通' },
          { label: '合同准备', value: '合同准备' },
          { label: '签约完成', value: '签约完成' },
        ],
      },
      fieldName: 'progress',
      label: $t('page.agent.progress'),
    },
    {
      component: 'RangePicker',
      componentProps: {
        format: 'YYYY-MM-DD',
        placeholder: ['开始日期', '结束日期'],
        valueFormat: 'YYYY-MM-DD',
      },
      fieldName: 'meetingTime',
      label: $t('page.common.date'),
    },
  ];
}

export function useColumns<T = SystemFinanceApi.SystemFinance>(
  onActionClick: OnActionClickFn<T>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'tenantName',
      minWidth: 150,
      title: $t('page.tenant.name'),
    },
    {
      field: 'agentName',
      minWidth: 150,
      title: $t('page.agent.name'),
    },
    {
      cellRender: {
        name: 'CellTag',
        options: getTagTypeOptions(),
      },
      field: 'intentLevel',
      minWidth: 100,
      title: $t('page.agent.intentLevel'),
    },
    {
      field: 'intentArea',
      formatter: ({ cellValue }) => {
        return `${cellValue}㎡`;
      },
      minWidth: 150,
      title: $t('page.agent.intentArea'),
    },
    {
      field: 'progress',
      minWidth: 120,
      title: $t('page.agent.progress'),
    },
    {
      field: 'phoneNumber',
      minWidth: 150,
      title: $t('page.agent.phone'),
    },
    {
      field: 'meetingTime',
      formatter: ({ cellValue }) => {
        return formatDateTime(cellValue);
      },
      minWidth: 150,
      title: $t('page.common.date'),
    },
    {
      field: 'remark',
      minWidth: 150,
      title: $t('page.common.remark'),
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'agentName',
          nameTitle: $t('page.agent.name'),
          onClick: onActionClick,
        },
        name: 'CellOperation',
        options: ['edit', 'delete'],
      },
      field: 'operation',
      fixed: 'right',
      minWidth: 130,
      title: $t('system.role.operation'),
    },
  ];
}
